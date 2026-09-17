"use server";

import { revalidatePath } from "next/cache";
import { addAsset } from "@/lib/data";
import { requireContext } from "@/lib/session";
import type { Asset } from "@/lib/types";

export async function createAsset(formData: FormData) {
  const { accessToken, spreadsheetId } = await requireContext();

  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "fund") as Asset["type"];
  const category = String(formData.get("category") ?? "").trim();
  const currency = String(formData.get("currency") ?? "THB") as Asset["currency"];

  if (!name || !category) {
    throw new Error("กรุณากรอกชื่อและหมวดของสินทรัพย์");
  }

  await addAsset(accessToken, spreadsheetId, {
    id: crypto.randomUUID(),
    name,
    type,
    category,
    currency,
  });

  revalidatePath("/assets");
  revalidatePath("/");
  revalidatePath("/prices");
  revalidatePath("/transactions");
}
