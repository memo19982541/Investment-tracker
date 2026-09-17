"use server";

import { revalidatePath } from "next/cache";
import { addTransaction } from "@/lib/data";
import { requireContext } from "@/lib/session";
import type { Transaction } from "@/lib/types";

export async function createTransaction(formData: FormData) {
  const { accessToken, spreadsheetId } = await requireContext();

  const assetId = String(formData.get("assetId") ?? "");
  const date = String(formData.get("date") ?? "");
  const type = String(formData.get("type") ?? "buy") as Transaction["type"];
  const units = Number(formData.get("units"));
  const pricePerUnit = Number(formData.get("pricePerUnit"));
  const note = String(formData.get("note") ?? "");

  if (!assetId || !date || !units || !pricePerUnit) {
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
