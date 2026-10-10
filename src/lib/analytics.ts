import type { Asset, Currency, FundLogEntry, Snapshot, Transaction } from "./types";

export interface CategorySeriesPoint {
  date: string;
  [category: string]: number | string;
}

/** Pivots each snapshot's byCategoryJson into one numeric column per category. */
export function buildCategorySeries(
  snapshots: Snapshot[],
  currency: Currency
): { points: CategorySeriesPoint[]; categories: string[] } {
  const filtered = snapshots
    .filter((s) => s.currency === currency)
    .sort((a, b) => a.date.localeCompare(b.date));

  const categorySet = new Set<string>();
  const points: CategorySeriesPoint[] = filtered.map((s) => {
    const point: CategorySeriesPoint = { date: s.date };
    let byCategory: Record<string, { value: number; cost: number }> = {};
    try {
      byCategory = JSON.parse(s.byCategoryJson || "{}");
    } catch {
      byCategory = {};
    }
    for (const [cat, v] of Object.entries(byCategory)) {
      categorySet.add(cat);
      point[cat] = v.value;
    }
    return point;
  });

  return { points, categories: [...categorySet].sort() };
}

export interface FundSeriesPoint {
  date: string;
  price: number;
  value: number;
}

export function buildFundSeries(
  fundLog: FundLogEntry[],
  assetId: string
): FundSeriesPoint[] {
  return fundLog
    .filter((f) => f.assetId === assetId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((f) => ({ date: f.date, price: f.price, value: f.value }));
}

export interface TradeMarker {
  date: string;
  price: number;
  type: Transaction["type"];
}

export function buildTradeMarkers(
  transactions: Transaction[],
  assetId: string
): TradeMarker[] {
  return transactions
    .filter((t) => t.assetId === assetId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => ({ date: t.date, price: t.pricePerUnit, type: t.type }));
}

export interface NoTradePoint {
  date: string;
  actual: number;
  noTradeMonth: number | null;
  noTradeAllTime: number | null;
}

export interface RealizedPnlEvent {
  date: string;
  pnl: number;
  assetId: string;
  units: number;
  proceeds: number;
  costBasis: number;
}

/**
 * Replays each asset's buy/sell history (average-cost method, same
 * sequencing as computeHoldings) and records the realized gain/loss booked
 * on every sell — sale proceeds minus the average cost of the units sold.
 * Needed to separate "totalCost changed because a trade realized a
 * gain/loss" from "totalCost changed because money was actually deposited
 * or withdrawn", which the no-trade baseline must not conflate. Also used
 * directly by the Analysis page to list realized sales within a period.
 */
export function computeRealizedPnlEvents(
  transactions: Transaction[],
  assets: Asset[],
  currency: Currency
): RealizedPnlEvent[] {
  const relevantAssetIds = assets
    .filter((a) => a.currency === currency)
    .map((a) => a.id);

  const events: RealizedPnlEvent[] = [];
  for (const assetId of relevantAssetIds) {
    const assetTx = transactions
      .filter((t) => t.assetId === assetId)
      .sort((a, b) => a.date.localeCompare(b.date));

    let units = 0;
    let cost = 0;
    for (const t of assetTx) {
      if (t.type === "buy") {
        units += t.units;
        cost += t.totalValue;
      } else {
        const avgCost = units > 0 ? cost / units : 0;
        const costRemoved = avgCost * t.units;
        events.push({
          date: t.date,
          pnl: t.totalValue - costRemoved,
          assetId,
          units: t.units,
          proceeds: t.totalValue,
          costBasis: costRemoved,
        });
        units -= t.units;
        cost -= costRemoved;
      }
    }
  }
  return events;
}

/** The most recent snapshot on or before `date`, or null if none exists yet. */
export function snapshotStatsAtDate(
  snapshots: Snapshot[],
  currency: Currency,
  date: string
): { totalValue: number; totalCost: number } | null {
  let best: Snapshot | null = null;
  for (const s of snapshots) {
    if (s.currency !== currency || s.date > date) continue;
    if (!best || s.date > best.date) best = s;
  }
  return best ? { totalValue: best.totalValue, totalCost: best.totalCost } : null;
}

/** Wednesday or Saturday for an ISO "YYYY-MM-DD" date (no time component, so UTC is safe). */
export function isKeeperDayOfWeek(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 3 || day === 6;
}

function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000;
}

/**
 * Capital base for a period's return % that doesn't reward deposits: the
 * value at the start plus every net deposit/withdrawal weighted by how much
 * of the period that money was in the portfolio (the "modified Dietz"
 * method). Dividing the period's P&L by this, instead of by the start value
 * alone, stops mid-period deposits from inflating the %.
 *
 * Money flows are read off consecutive snapshots: the cost change between
 * two snapshots minus the gains realized by selling in between (selling
 * shifts cost by exactly the realized gain, see the Analysis bars). Each
 * flow is assumed to land mid-way between its two snapshots. Returns null if
 * fewer than two snapshots fall in the period.
 */
export function computePeriodCapitalBase(
  snapshots: Snapshot[],
  transactions: Transaction[],
  assets: Asset[],
  currency: Currency,
  periodStart: string,
  today: string
): { base: number; netFlows: number } | null {
  const sorted = snapshots
    .filter((s) => s.currency === currency)
    .sort((a, b) => a.date.localeCompare(b.date));
  let startIdx = -1;
  let endIdx = -1;
  sorted.forEach((s, i) => {
    if (s.date <= periodStart) startIdx = i;
    if (s.date <= today) endIdx = i;
  });
  if (startIdx < 0 || endIdx <= startIdx) return null;

  const series = sorted.slice(startIdx, endIdx + 1);
  const startDate = series[0].date;
  const total = daysBetween(startDate, series[series.length - 1].date);
  if (total <= 0) return null;

  const realized = computeRealizedPnlEvents(transactions, assets, currency);
  let base = series[0].totalValue;
  let netFlows = 0;
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1];
    const cur = series[i];
    const realizedBetween = realized
      .filter((e) => e.date > prev.date && e.date <= cur.date)
      .reduce((sum, e) => sum + e.pnl, 0);
    const flow = cur.totalCost - prev.totalCost - realizedBetween;
    const mid = (daysBetween(startDate, prev.date) + daysBetween(startDate, cur.date)) / 2;
    base += flow * ((total - mid) / total);
    netFlows += flow;
  }
  return { base, netFlows };
}

export interface SnapshotChange {
  /** The earlier snapshot compared against. */
  prevDate: string;
  change: number;
  pct: number;
}

/**
 * How much the portfolio moved since the last retained snapshot before
 * `today`, excluding deposits/withdrawals — same idea as the Analysis page:
 * realized gains from sells since then plus the change in (value − cost).
 *
 * Only snapshots that survive pruning (Wed/Sat or manual) count as the
 * baseline, so the comparison point doesn't jump around depending on whether
 * the pruning has run yet today. Realized events cover every asset of the
 * currency, hidden or not, because the snapshot's P&L included assets that
 * have since been sold out and hidden.
 */
export function computeChangeSincePrevious(
  snapshots: Snapshot[],
  transactions: Transaction[],
  assets: Asset[],
  currency: Currency,
  currentValue: number,
  currentCost: number,
  today: string
): SnapshotChange | null {
  let prev: Snapshot | null = null;
  for (const s of snapshots) {
    if (s.currency !== currency || s.date >= today) continue;
    if (!s.manual && !isKeeperDayOfWeek(s.date)) continue;
    if (!prev || s.date > prev.date) prev = s;
  }
  if (!prev) return null;

  const prevDate = prev.date;
  const prevPnl = prev.totalValue - prev.totalCost;
  const realizedSince = computeRealizedPnlEvents(transactions, assets, currency)
    .filter((e) => e.date > prevDate && e.date <= today)
    .reduce((sum, e) => sum + e.pnl, 0);

  const change = currentValue - currentCost - prevPnl + realizedSince;
  return { prevDate, change, pct: prev.totalValue > 0 ? (change / prev.totalValue) * 100 : 0 };
}

/**
 * Trade-vs-no-trade comparison, matching the baseline formula from the
 * user's "บันทึกข้อมูล" Apps Script: freeze each held fund's units at a
 * baseline date, revalue those frozen units at the current date's price,
 * then add the net cost-basis change since baseline (deposits/withdrawals).
 * Two baselines: "month" resets to the latest snapshot before the current
 * calendar month; "allTime" is fixed at the very first snapshot.
 *
 * "Deposits/withdrawals" is approximated as totalCost(now) - totalCost(baseline)
 * minus realized gain/loss booked in between — otherwise selling a fund at a
 * profit or loss (even when fully reinvested elsewhere) shows up as if money
 * had been added to or removed from the portfolio.
 */
export function computeNoTradeSeries(
  fundLog: FundLogEntry[],
  snapshots: Snapshot[],
  transactions: Transaction[],
  assets: Asset[],
  currency: Currency
): NoTradePoint[] {
  const assetIds = new Set(
    assets.filter((a) => a.currency === currency).map((a) => a.id)
  );
  const relevantLog = fundLog.filter((f) => assetIds.has(f.assetId));
  if (relevantLog.length === 0) return [];

  const logByDate = new Map<string, Map<string, FundLogEntry>>();
  for (const row of relevantLog) {
    const m = logByDate.get(row.date) ?? new Map<string, FundLogEntry>();
    m.set(row.assetId, row);
    logByDate.set(row.date, m);
  }

  const snapshotByDate = new Map<string, Snapshot>();
  for (const s of snapshots) {
    if (s.currency === currency) snapshotByDate.set(s.date, s);
  }

  // Driven by snapshot dates, not fundLog dates: fundLog can (and, once a
  // fund's history gets backfilled from settrade.com, will) hold NAV points
  // reaching back further than this portfolio has ever been tracked, or
  // further back than the fund was even bought. Those dates have no "actual"
  // portfolio value at all, so they must not become baselines or rows here.
  const dates = [...snapshotByDate.keys()].sort();
  const allTimeBaselineDate = dates[0];

  const realizedPnlEvents = computeRealizedPnlEvents(transactions, assets, currency);
  function realizedPnlSince(baselineDate: string, currentDate: string): number {
    let sum = 0;
    for (const e of realizedPnlEvents) {
      if (e.date > baselineDate && e.date <= currentDate) sum += e.pnl;
    }
    return sum;
  }

  function frozenValueAt(baselineDate: string, currentDate: string): number {
    const baselineRow = logByDate.get(baselineDate);
    const currentRow = logByDate.get(currentDate);
    if (!baselineRow || !currentRow) return 0;
    let total = 0;
    for (const [assetId, entry] of baselineRow) {
      const priceNow = currentRow.get(assetId)?.price ?? entry.price;
      total += entry.units * priceNow;
    }
    return total;
  }

  function noTradeValueAt(
    baselineDate: string | undefined,
    currentDate: string
  ): number | null {
    if (!baselineDate) return null;
    const baselineSnap = snapshotByDate.get(baselineDate);
    const currentSnap = snapshotByDate.get(currentDate);
    if (!baselineSnap || !currentSnap) return null;
    const frozen = frozenValueAt(baselineDate, currentDate);
    const portFlow =
      currentSnap.totalCost -
      baselineSnap.totalCost -
      realizedPnlSince(baselineDate, currentDate);
    return frozen + portFlow;
  }

  function monthBaselineFor(date: string): string | undefined {
    const firstOfMonth = `${date.slice(0, 7)}-01`;
    let baseline: string | undefined;
    for (const d of dates) {
      if (d < firstOfMonth) baseline = d;
      else break;
    }
    return baseline ?? allTimeBaselineDate;
  }

  return dates.map((date) => {
    const currentSnap = snapshotByDate.get(date);
    return {
      date,
      actual: currentSnap?.totalValue ?? 0,
      noTradeMonth: noTradeValueAt(monthBaselineFor(date), date),
      noTradeAllTime: noTradeValueAt(allTimeBaselineDate, date),
    };
  });
}
