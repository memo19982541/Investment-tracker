"use server";

import { revalidatePath } from "next/cache";
import { addTransaction, deleteTransaction, getAssets } from "@/lib/data";
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

  revalidatePath("/transactions");
  revalidatePath("/");
}

export async function removeTransaction(transactionId: string) {
  const { accessToken, spreadsheetId } = await requireContext();

  await deleteTransaction(accessToken, spreadsheetId, transactionId);

  revalidatePath("/transactions");
  revalidatePath("/");
}
