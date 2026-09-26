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
