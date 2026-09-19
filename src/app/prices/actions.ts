"use server";

import { revalidatePath } from "next/cache";
import {
  appendFundLogRows,
  getAssets,
  getFundLog,
  getPrices,
  getTransactions,
  recordSnapshotAndFundLog,
  setPrice,
} from "@/lib/data";
import { runFetchLatestPrices, type FetchPricesResult } from "@/lib/priceFetchJob";
import { fetchFundNavHistory } from "@/lib/priceSource";
import { requireContext } from "@/lib/session";
import type { FundLogEntry } from "@/lib/types";

export async function updatePrices(formData: FormData) {
  const { accessToken, spreadsheetId } = await requireContext();

  const assets = await getAssets(accessToken, spreadsheetId);

  for (const asset of assets) {
    const raw = formData.get(`price_${asset.id}`);
    if (raw === null || raw === "") continue;
    const price = Number(raw);
    if (!Number.isFinite(price) || price < 0) continue;
    await setPrice(accessToken, spreadsheetId, asset.id, price);
  }

  const [transactions, prices] = await Promise.all([
    getTransactions(accessToken, spreadsheetId),
    getPrices(accessToken, spreadsheetId),
  ]);
  await recordSnapshotAndFundLog(
    accessToken,
    spreadsheetId,
    assets,
    transactions,
    prices
  );

  revalidatePath("/prices");
  revalidatePath("/");
  revalidatePath("/history");
}

export type { FetchPricesResult };

export interface BackfillFundHistoryResult {
  added: number;
  mismatched: string[];
  skipped: number;
  fetched: number;
}

const UNITS_TOLERANCE = 0.01;

/**
 * Backfills fundLog for one fund from settrade.com's own embedded NAV
 * history, replaying this app's own transactions to compute the units/cost
 * actually held at each historical NAV date — needed for funds that were
 * fully sold (or just re-added after being deleted) so the no-trade
 * baseline has real price/units data before today instead of a gap. Only
 * fills in dates with no existing fundLog row — it never overwrites one.
 *
 * If a date already has a row whose units disagree with what replaying
 * `transactions` implies, that date is reported back (`mismatched`) rather
 * than "fixed": the transaction history is itself just data entered by
 * hand and can be the wrong one (e.g. a sell recorded on the wrong date) —
 * silently trusting it over an existing row has caused real corruption
 * before. A human needs to decide which side is right.
 */
export async function backfillFundHistory(
  assetId: string
): Promise<BackfillFundHistoryResult> {
  const { accessToken, spreadsheetId } = await requireContext();

  const [assets, transactions, existingLog] = await Promise.all([
    getAssets(accessToken, spreadsheetId),
    getTransactions(accessToken, spreadsheetId),
    getFundLog(accessToken, spreadsheetId),
  ]);
  const asset = assets.find((a) => a.id === assetId);
  if (!asset || asset.type !== "fund")
    return { added: 0, mismatched: [], skipped: 0, fetched: 0 };

  const navHistory = await fetchFundNavHistory(asset.name);
  if (navHistory.length === 0)
    return { added: 0, mismatched: [], skipped: 0, fetched: 0 };
  const sortedNav = [...navHistory].sort((a, b) => a.navDate.localeCompare(b.navDate));

  const assetTx = transactions
    .filter((t) => t.assetId === assetId)
    .sort((a, b) => a.date.localeCompare(b.date));
  const existingByDate = new Map(
    existingLog.filter((f) => f.assetId === assetId).map((f) => [f.date, f])
  );

  let units = 0;
  let cost = 0;
  let txIdx = 0;
  const toCreate: Omit<FundLogEntry, "createdAt">[] = [];
  const mismatched: string[] = [];
  let skipped = 0;

  for (const point of sortedNav) {
    while (txIdx < assetTx.length && assetTx[txIdx].date <= point.navDate) {
      const t = assetTx[txIdx];
      if (t.type === "buy") {
        units += t.units;
        cost += t.totalValue;
      } else {
        const avgCost = units > 0 ? cost / units : 0;
        units -= t.units;
        cost -= avgCost * t.units;
      }
      txIdx++;
    }
    units = Math.max(units, 0);
    cost = Math.max(cost, 0);

    const existing = existingByDate.get(point.navDate);
    if (existing) {
      if (Math.abs(existing.units - units) > UNITS_TOLERANCE) {
        mismatched.push(point.navDate);
      }
      skipped++;
      continue;
    }

    const value = units * point.price;
    toCreate.push({
      date: point.navDate,
      assetId,
      units,
      price: point.price,
      costPerUnit: units > 0 ? cost / units : 0,
      value,
      costValue: cost,
      pnl: value - cost,
    });
  }

  if (toCreate.length > 0) {
    await appendFundLogRows(accessToken, spreadsheetId, toCreate);
  }

  revalidatePath("/");
  revalidatePath("/transactions");

  return { added: toCreate.length, mismatched, skipped, fetched: sortedNav.length };
}

export async function fetchLatestFundPrices(): Promise<FetchPricesResult> {
  const { accessToken, spreadsheetId } = await requireContext();

  const result = await runFetchLatestPrices(accessToken, spreadsheetId);

  // Fetching prices only updates the "current price" cache — it does not
  // record a snapshot/fundLog entry. Use "บันทึกราคาและเก็บสแนปช็อตวันนี้"
  // for that, so fetching can be repeated during the day without piling up
  // duplicate history points.
  revalidatePath("/prices");
  revalidatePath("/");

  return result;
}
