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
  const note = String(formData.get("note") ?? "");

  if (!assetId || !date) {
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

  // Some brokers only report the total baht amount of a trade, not the
  // exact units — let the total value drive units/pricePerUnit instead,
  // for whichever side the form actually collected.
  const rawTotalValue = formData.get("totalValue");
  let units: number;
  let totalValue: number;
  if (rawTotalValue !== null && rawTotalValue !== "") {
    totalValue = Number(rawTotalValue);
    units = totalValue / pricePerUnit;
  } else {
    units = Number(formData.get("units"));
    totalValue = units * pricePerUnit;
  }

  if (!units || !totalValue) {
    throw new Error("กรุณากรอกข้อมูลให้ครบถ้วน");
  }

  await addTransaction(accessToken, spreadsheetId, {
    assetId,
    date,
    type,
    units,
    pricePerUnit,
    totalValue,
    note,
  });

  // Optionally mirror the trade on a cash asset (buy → cash withdrawal, sell
  // → cash deposit), so it doesn't need to be logged a second time by hand.
  const cashAssetId = String(formData.get("cashAssetId") ?? "");
  if (cashAssetId && asset && asset.type !== "cash") {
    const cashAsset = assets.find((a) => a.id === cashAssetId);
    if (!cashAsset || cashAsset.type !== "cash") {
      throw new Error("ไม่พบสินทรัพย์เงินสดที่เลือก");
    }
    if (cashAsset.currency !== asset.currency) {
      throw new Error("สกุลเงินของเงินสดไม่ตรงกับสินทรัพย์");
    }
    await addTransaction(accessToken, spreadsheetId, {
      assetId: cashAssetId,
      date,
      type: type === "buy" ? "sell" : "buy",
      units: totalValue,
      pricePerUnit: 1,
      totalValue,
      note: `${type === "buy" ? "ซื้อ" : "ขาย"} ${asset.name}`,
    });
  }

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
