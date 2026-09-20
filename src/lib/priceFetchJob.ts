import {
  getAssets,
  getPrices,
  getTransactions,
  recordSnapshotAndFundLogIfChanged,
  setPrice,
} from "./data";
import { fetchFundNav, fetchStockPrice } from "./priceSource";
import type { Asset } from "./types";

const FETCH_BATCH_SIZE = 5;

export interface FetchPricesResult {
  updated: { name: string; price: number; navDate: string }[];
  failed: { name: string }[];
}

function fetchPriceFor(asset: Asset) {
  if (asset.type === "fund") return fetchFundNav(asset.name);
  if (asset.type === "stock") return fetchStockPrice(asset.name);
  return Promise.resolve(null);
}

/** Fetches fresh prices for every fund/stock asset and updates the "current price" cache. */
export async function runFetchLatestPrices(
  accessToken: string,
  spreadsheetId: string
): Promise<FetchPricesResult> {
  const assets = await getAssets(accessToken, spreadsheetId);
  const priceableAssets = assets.filter(
    (a) => a.type === "fund" || a.type === "stock"
  );

  const updated: FetchPricesResult["updated"] = [];
  const failed: FetchPricesResult["failed"] = [];

  for (let i = 0; i < priceableAssets.length; i += FETCH_BATCH_SIZE) {
    const batch = priceableAssets.slice(i, i + FETCH_BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (asset) => ({ asset, nav: await fetchPriceFor(asset) }))
    );
    for (const { asset, nav } of results) {
      if (nav) {
        await setPrice(accessToken, spreadsheetId, asset.id, nav.price, nav.navDate);
        updated.push({ name: asset.name, price: nav.price, navDate: nav.navDate });
      } else {
        failed.push({ name: asset.name });
      }
    }
  }

  return { updated, failed };
}

/**
 * Full daily update: fetch latest prices, then record today's snapshot and
 * fundLog entries — but only if the resulting totals actually differ from
 * the last recorded snapshot. Thai fund NAVs are republished with a
 * multi-day lag, so most days nothing has really changed; skipping those
 * keeps the history free of duplicate points while still capturing every
 * day something (a price or a transaction) genuinely moved.
 */
export async function runDailyPriceUpdate(accessToken: string, spreadsheetId: string) {
  const fetchResult = await runFetchLatestPrices(accessToken, spreadsheetId);

  const [assets, transactions, prices] = await Promise.all([
    getAssets(accessToken, spreadsheetId),
    getTransactions(accessToken, spreadsheetId),
    getPrices(accessToken, spreadsheetId),
  ]);
  const { recorded } = await recordSnapshotAndFundLogIfChanged(
    accessToken,
    spreadsheetId,
    assets,
    transactions,
    prices
  );

  return { ...fetchResult, snapshotRecorded: recorded };
}
