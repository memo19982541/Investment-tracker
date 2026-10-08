import {
  getAssets,
  getPrices,
  getTransactions,
  pruneNonKeeperSnapshots,
  recordSnapshotAndFundLog,
  setPricesBulk,
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
  const priceUpdates: { assetId: string; price: number; navDate: string }[] = [];

  for (let i = 0; i < priceableAssets.length; i += FETCH_BATCH_SIZE) {
    const batch = priceableAssets.slice(i, i + FETCH_BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (asset) => ({ asset, nav: await fetchPriceFor(asset) }))
    );
    for (const { asset, nav } of results) {
      if (nav) {
        priceUpdates.push({ assetId: asset.id, price: nav.price, navDate: nav.navDate });
        updated.push({ name: asset.name, price: nav.price, navDate: nav.navDate });
      } else {
        failed.push({ name: asset.name });
      }
    }
  }

  // One bulk write instead of one Sheets round-trip per asset — the
  // per-asset version serialized ~3 API calls × 17 assets and could take
  // 25-30s, risking a foreground button click exceeding the serverless
  // function's execution timeout.
  await setPricesBulk(accessToken, spreadsheetId, priceUpdates);

  return { updated, failed };
}

/**
 * Full daily update: fetch latest prices, record today's snapshot and
 * fundLog entries, then prune past non-keeper-day snapshots and their
 * fundLog rows (anything not Wednesday/Saturday and not manually saved) so
 * history settles into roughly two points a week instead of piling up
 * duplicates from Thai funds' multi-day NAV lag.
 */
export async function runDailyPriceUpdate(accessToken: string, spreadsheetId: string) {
  const fetchResult = await runFetchLatestPrices(accessToken, spreadsheetId);

  const [assets, transactions, prices] = await Promise.all([
    getAssets(accessToken, spreadsheetId),
    getTransactions(accessToken, spreadsheetId),
    getPrices(accessToken, spreadsheetId),
  ]);
  await recordSnapshotAndFundLog(accessToken, spreadsheetId, assets, transactions, prices, false);
  const { pruned } = await pruneNonKeeperSnapshots(accessToken, spreadsheetId);

  return { ...fetchResult, snapshotPruned: pruned };
}
