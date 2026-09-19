"use server";

import { revalidatePath } from "next/cache";
import {
  addAsset,
  computeHoldings,
  deleteAsset,
  deleteTransactionsByAsset,
  getAssets,
  getPrices,
  getTransactions,
  sortAssetsForDisplay,
  updateAssetMeta,
} from "@/lib/data";
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

export async function removeAsset(assetId: string) {
  const { accessToken, spreadsheetId } = await requireContext();

  await Promise.all([
    deleteAsset(accessToken, spreadsheetId, assetId),
    deleteTransactionsByAsset(accessToken, spreadsheetId, assetId),
  ]);

  revalidatePath("/assets");
  revalidatePath("/");
  revalidatePath("/prices");
  revalidatePath("/transactions");
}

/**
 * Moves an asset up/down among the *currently visible* holdings of the same
 * currency (units > 0.0001) — the same set and filter the dashboard renders,
 * so up/down always swaps with the adjacent visible row.
 */
export async function moveAssetOrder(assetId: string, direction: "up" | "down") {
  const { accessToken, spreadsheetId } = await requireContext();
  const [assets, transactions, prices] = await Promise.all([
    getAssets(accessToken, spreadsheetId),
    getTransactions(accessToken, spreadsheetId),
    getPrices(accessToken, spreadsheetId),
  ]);
  const target = assets.find((a) => a.id === assetId);
  if (!target) return;

  const visibleAssets = computeHoldings(assets, transactions, prices)
    .filter(
      (h) =>
        h.units > 0.0001 && h.asset.currency === target.currency && !h.asset.hidden
    )
    .map((h) => h.asset);
  const group = sortAssetsForDisplay(visibleAssets);
  const needsInit = group.some((a) => a.order === undefined);

  let ordered = group;
  if (needsInit) {
    ordered = group.map((a, i) => ({ ...a, order: i }));
    await Promise.all(
      ordered.map((a) =>
        updateAssetMeta(accessToken, spreadsheetId, a.id, { order: a.order! })
      )
    );
  }

  const idx = ordered.findIndex((a) => a.id === assetId);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx >= 0 && swapIdx < ordered.length) {
    const a = ordered[idx];
    const b = ordered[swapIdx];
    await Promise.all([
      updateAssetMeta(accessToken, spreadsheetId, a.id, { order: b.order! }),
      updateAssetMeta(accessToken, spreadsheetId, b.id, { order: a.order! }),
    ]);
  }

  revalidatePath("/");
}

export async function updateTargetPct(assetId: string, pct: number | null) {
  const { accessToken, spreadsheetId } = await requireContext();
  await updateAssetMeta(accessToken, spreadsheetId, assetId, { targetPct: pct });
  revalidatePath("/");
}

export async function setAssetHidden(assetId: string, hidden: boolean) {
  const { accessToken, spreadsheetId } = await requireContext();
  await updateAssetMeta(accessToken, spreadsheetId, assetId, { hidden });
  revalidatePath("/assets");
  revalidatePath("/");
}
