import { fetchStockPriceHistory, type FundNavPoint } from "./priceSource";
import type { FundLogEntry, Transaction } from "./types";

/**
 * Estimates a Thai feeder fund's cost basis in terms of its underlying
 * master fund's own price (in the master fund's own currency) — useful
 * since a Thai fund's NAV (baht/unit) has no direct 1:1 relationship to the
 * master fund's real share price, only a proportional one (the feeder
 * fund's own unit denomination, cash drag, fees, etc. all scale it by some
 * constant).
 *
 * Calibrates that constant `k` from: NAV_THB(d) ≈ k × masterPrice(d) ×
 * fx(d), where `fx` is the master fund's currency expressed in THB (e.g.
 * "USDTHB=X", "JPYTHB=X") — using the fund's own recorded NAV history
 * (fundLog) against the master ticker's and that FX pair's historical
 * prices (both fetched from Yahoo Finance, same source already used for US
 * stock prices), taking the median ratio across all overlapping dates to
 * resist outlier days (a stale/late-republished Thai NAV, a data glitch,
 * etc).
 *
 * This is inherently an estimate, not an exact accounting figure — `ticker`
 * is usually a close public proxy for the fund's real (often
 * institutional-only) master fund share class, and fees/cash drag can
 * cause slow drift in `k` over time. Using the wrong `masterCurrency` for
 * the ticker's actual pricing currency (e.g. treating a JPY-priced index as
 * USD) breaks the calibration just as badly as a dividend-paying fund does.
 */
export interface MasterFundCostResult {
  ticker: string;
  currency: string;
  sampleCount: number;
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

/** Latest known price on or before `date`, via binary search over sorted dates. */
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

const MIN_CALIBRATION_SAMPLES = 3;

export async function computeMasterFundImpliedCost(
  ticker: string,
  masterCurrency: string,
  assetFundLog: FundLogEntry[],
  assetTransactions: Transaction[],
  currentThaiPrice: number
): Promise<MasterFundCostResult | null> {
  const fxTicker = `${masterCurrency}THB=X`;
  const [masterHistory, fxHistory] = await Promise.all([
    fetchStockPriceHistory(ticker),
    fetchStockPriceHistory(fxTicker),
  ]);
  if (masterHistory.length === 0 || fxHistory.length === 0) return null;

  const masterMap = buildPriceMap(masterHistory);
  const masterDates = [...masterMap.keys()].sort();
  const fxMap = buildPriceMap(fxHistory);
  const fxDates = [...fxMap.keys()].sort();

  const ratios: number[] = [];
  for (const entry of assetFundLog) {
    if (!(entry.price > 0)) continue;
    const masterPrice = nearestPriorPrice(masterDates, masterMap, entry.date);
    const fx = nearestPriorPrice(fxDates, fxMap, entry.date);
    if (masterPrice == null || fx == null || masterPrice <= 0 || fx <= 0) continue;
    ratios.push(entry.price / (masterPrice * fx));
  }
  if (ratios.length < MIN_CALIBRATION_SAMPLES) return null;
  ratios.sort((a, b) => a - b);
  const k = ratios[Math.floor(ratios.length / 2)];

  const sortedTx = [...assetTransactions].sort((a, b) => a.date.localeCompare(b.date));
  let units = 0;
  let cost = 0;
  for (const t of sortedTx) {
    if (t.type === "buy") {
      const fx = nearestPriorPrice(fxDates, fxMap, t.date);
      const impliedPrice = fx && fx > 0 ? t.pricePerUnit / (fx * k) : 0;
      units += t.units;
      cost += impliedPrice * t.units;
    } else {
      const avgCost = units > 0 ? cost / units : 0;
      units -= t.units;
      cost -= avgCost * t.units;
    }
  }
  units = Math.max(units, 0);
  cost = Math.max(cost, 0);
  const avgImpliedCost = units > 0 ? cost / units : 0;

  const latestFx = fxMap.get(fxDates[fxDates.length - 1]) ?? 0;
  const currentTickerPrice = masterMap.get(masterDates[masterDates.length - 1]) ?? 0;
  const currentImpliedPrice =
    latestFx > 0 && currentThaiPrice > 0 ? currentThaiPrice / (latestFx * k) : 0;

  const diffPct =
    avgImpliedCost > 0 ? ((currentImpliedPrice - avgImpliedCost) / avgImpliedCost) * 100 : 0;

  return {
    ticker,
    currency: masterCurrency,
    sampleCount: ratios.length,
    k,
    avgImpliedCost,
    currentImpliedPrice,
    currentTickerPrice,
    diffPct,
  };
}
