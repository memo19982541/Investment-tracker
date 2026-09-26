"use server";

import { revalidatePath } from "next/cache";
import {
  addTransaction,
  deleteTransaction,
  getAssets,
  getPrices,
  getTransactions,
  recordSnapshotAndFundLog,
} from "@/lib/data";
import { requireContext } from "@/lib/session";
import type { Transaction } from "@/lib/types";

export async function createTransaction(formData: FormData) {
  const { accessToken, spreadsheetId } = await requireContext();

  const assetId = String(formData.get("assetId") ?? "");
  const date = String(formData.get("date") ?? "");
  const type = String(formData.get("type") ?? "buy") as Transaction["type"];
  const units = Number(formData.get("units"));
  const note = String(formData.get("note") ?? "");

  if (!assetId || !date || !units) {
    throw new Error("กรุณากรอกข้อมูลให้ครบถ้วน");
  }

  const assets = await getAssets(accessToken, spreadsheetId);
  const asset = assets.find((a) => a.id === assetId);
  // Cash has no NAV — 1 unit is always worth 1 currency unit, so deposits/
  // withdrawals don't need a price entered.
  const pricePerUnit =
    asset?.type === "cash" ? 1 : Number(formData.get("pricePerUnit"));

  if (!pricePerUnit) {
    throw new Error("กรุณากรอกข้อมูลให้ครบถ้วน");
  }

  await addTransaction(accessToken, spreadsheetId, {
    assetId,
    date,
    type,
    units,
    pricePerUnit,
    totalValue: units * pricePerUnit,
    note,
  });

  await recordTodaySnapshot(accessToken, spreadsheetId, assets);

  revalidatePath("/transactions");
  revalidatePath("/");
}

export async function removeTransaction(transactionId: string) {
  const { accessToken, spreadsheetId } = await requireContext();

  await deleteTransaction(accessToken, spreadsheetId, transactionId);

  const assets = await getAssets(accessToken, spreadsheetId);
  await recordTodaySnapshot(accessToken, spreadsheetId, assets);

  revalidatePath("/transactions");
  revalidatePath("/");
}

/**
 * Re-records today's snapshot/fundLog right after a transaction is added or
 * removed, so the dashboard's history charts (which only read from
 * `snapshots`, not live `transactions`) reflect the change immediately
 * instead of waiting for the next daily cron run or a manual price save.
 * NOT marked manual — this is just keeping today's point accurate, not a
 * deliberate checkpoint, so it stays eligible for the daily cron's
 * weekend-retention pruning like any other day. `manual: true` is reserved
 * for the explicit "save snapshot" button on /prices.
 */
async function recordTodaySnapshot(
  accessToken: string,
  spreadsheetId: string,
  assets: Awaited<ReturnType<typeof getAssets>>
) {
  const [transactions, prices] = await Promise.all([
    getTransactions(accessToken, spreadsheetId),
    getPrices(accessToken, spreadsheetId),
  ]);
  await recordSnapshotAndFundLog(accessToken, spreadsheetId, assets, transactions, prices, false);
}
