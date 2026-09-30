import { fetchStockPriceHistory, type FundNavPoint } from "./priceSource";
import type { FundLogEntry, Transaction } from "./types";

/**
 * Restates a Thai feeder fund's average cost as a level of its underlying
 * master fund's price ("the index level at which your cost equals today's
 * NAV-relative position"), so the two can be compared directly.
 *
 * Uses ONE reference point: the fund's latest NAV against the master
 * ticker's close for the pricing day, giving a fixed ratio
 * `k = NAV_THB / masterPrice`. Each purchase's NAV is divided by that same
 * `k`, so the implied cost sits above/below the master price by exactly the
 * fund's own gain/loss %. FX is deliberately NOT applied per purchase: it is
 * already inside the NAV, and re-applying it made the estimate swing with
 * the baht's moves. A Thai NAV dated d is struck from the previous US close,
 * so the master price is the last close strictly BEFORE d.
 *
 * The anchor is the price the app currently shows at its true NAV date (the
 * fund log's own date is when a row was recorded, not when the NAV was
 * struck); older log rows are only a fallback.
 */
export interface MasterFundCostResult {
  ticker: string;
  currency: string;
  /** Date of the Thai NAV used as the single calibration anchor. */
  anchorDate: string;
  k: number;
  avgImpliedCost: number;
  currentImpliedPrice: number;
  currentTickerPrice: number;
  diffPct: number;
}

function buildPriceMap(points: FundNavPoint[]) {
  const map = new Map<string, number>();
  for (const p of points) map.set(p.navDate, p.price);
  return map;
}

/** Latest known price on or before `date` (pass the day before for "strictly before"), via binary search over sorted dates. */
function nearestPriorPrice(
  sortedDates: string[],
  map: Map<string, number>,
  date: string
): number | null {
  let lo = 0;
  let hi = sortedDates.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sortedDates[mid] <= date) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans >= 0 ? (map.get(sortedDates[ans]) ?? null) : null;
}

export async function computeMasterFundImpliedCost(
  ticker: string,
  masterCurrency: string,
  assetFundLog: FundLogEntry[],
  assetTransactions: Transaction[],
  currentThaiPrice: number,
  currentNavDate?: string
): Promise<MasterFundCostResult | null> {
  const masterHistory = await fetchStockPriceHistory(ticker, "3mo");
  if (masterHistory.length === 0) return null;

  const masterMap = buildPriceMap(masterHistory);
  const masterDates = [...masterMap.keys()].sort();

  const candidates: { date: string; price: number }[] = [];
  if (currentNavDate && currentThaiPrice > 0) {
    candidates.push({ date: currentNavDate, price: currentThaiPrice });
  }
  candidates.push(...[...assetFundLog].sort((a, b) => b.date.localeCompare(a.date)));
  let k = 0;
  let anchorDate = "";
  for (const entry of candidates) {
    if (!(entry.price > 0)) continue;
    const prevDay = new Date(`${entry.date}T00:00:00Z`);
    prevDay.setUTCDate(prevDay.getUTCDate() - 1);
    const masterPrice = nearestPriorPrice(
      masterDates,
      masterMap,
      prevDay.toISOString().slice(0, 10)
    );
    if (masterPrice == null || masterPrice <= 0) continue;
    k = entry.price / masterPrice;
    anchorDate = entry.date;
    break;
  }
  if (!(k > 0)) return null;

  const sortedTx = [...assetTransactions].sort((a, b) => a.date.localeCompare(b.date));
  let units = 0;
  let cost = 0;
  for (const t of sortedTx) {
    if (t.type === "buy") {
      units += t.units;
      cost += (t.pricePerUnit / k) * t.units;
    } else {
      const avgCost = units > 0 ? cost / units : 0;
      units -= t.units;
      cost -= avgCost * t.units;
    }
  }
  units = Math.max(units, 0);
  cost = Math.max(cost, 0);
  const avgImpliedCost = units > 0 ? cost / units : 0;

  const currentTickerPrice = masterMap.get(masterDates[masterDates.length - 1]) ?? 0;
  const currentImpliedPrice = currentThaiPrice > 0 ? currentThaiPrice / k : 0;

  const diffPct =
    avgImpliedCost > 0 ? ((currentImpliedPrice - avgImpliedCost) / avgImpliedCost) * 100 : 0;

  return {
    ticker,
    currency: masterCurrency,
    anchorDate,
    k,
    avgImpliedCost,
    currentImpliedPrice,
    currentTickerPrice,
    diffPct,
  };
}
