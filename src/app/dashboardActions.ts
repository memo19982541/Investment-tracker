"use server";

import { getAssets } from "@/lib/data";
import {
  fetchFundNavHistory,
  fetchStockPriceHistory,
  type FundNavPoint,
} from "@/lib/priceSource";
import { requireContext } from "@/lib/session";

/**
 * On-demand price history for the dashboard's per-fund/stock chart, fetched
 * fresh from settrade.com (funds) or Yahoo Finance (stocks) when an asset is
 * selected (not stored) — gives a rich price line immediately instead of
 * waiting for our own fundLog to accumulate day by day.
 */
export async function getFundPriceHistory(assetId: string): Promise<FundNavPoint[]> {
  const { accessToken, spreadsheetId } = await requireContext();
  const assets = await getAssets(accessToken, spreadsheetId);
  const asset = assets.find((a) => a.id === assetId);
  if (!asset) return [];
  if (asset.type === "fund") return fetchFundNavHistory(asset.name);
  if (asset.type === "stock") return fetchStockPriceHistory(asset.name);
  return [];
}
