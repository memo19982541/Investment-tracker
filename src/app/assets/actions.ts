"use server";

import { revalidatePath } from "next/cache";
import {
  addAsset,
  computeHoldings,
  deleteAsset,
  deleteTransactionsByAsset,
  getAssets,
  getFundLog,
  getPrices,
  getTransactions,
  sortAssetsForDisplay,
  updateAssetMeta,
} from "@/lib/data";
import { computeMasterFundImpliedCost, type MasterFundCostResult } from "@/lib/masterFund";
import { requireContext } from "@/lib/session";
import type { Asset } from "@/lib/types";

export async function createAsset(formData: FormData) {
  const { accessToken, spreadsheetId } = await requireContext();

  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "fund") as Asset["type"];
  const category = String(formData.get("category") ?? "").trim();
  const currency = String(formData.get("currency") ?? "THB") as Asset["currency"];
  const paysDividend = formData.get("paysDividend") === "on";

  if (!name || !category) {
    throw new Error("กรุณากรอกชื่อและหมวดของสินทรัพย์");
  }

  await addAsset(accessToken, spreadsheetId, {
    id: crypto.randomUUID(),
    name,
    type,
    category,
    currency,
    paysDividend,
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

export async function setAssetPaysDividend(assetId: string, paysDividend: boolean) {
  const { accessToken, spreadsheetId } = await requireContext();
  await updateAssetMeta(accessToken, spreadsheetId, assetId, { paysDividend });
  revalidatePath("/assets");
}

export async function setMasterFundTicker(assetId: string, ticker: string) {
  const { accessToken, spreadsheetId } = await requireContext();
  const trimmed = ticker.trim().toUpperCase();
  await updateAssetMeta(accessToken, spreadsheetId, assetId, {
    masterFundTicker: trimmed || null,
  });
  revalidatePath("/assets");
}

export async function setMasterFundCurrency(assetId: string, currency: string) {
  const { accessToken, spreadsheetId } = await requireContext();
  const trimmed = currency.trim().toUpperCase();
  await updateAssetMeta(accessToken, spreadsheetId, assetId, {
    masterFundCurrency: trimmed || null,
  });
  revalidatePath("/assets");
}

export type { MasterFundCostResult };

/**
 * On-demand only (never auto-run on page load): fetches the master
 * ticker's and its currency's THB exchange rate history from Yahoo Finance
 * and calibrates the implied cost — two external network calls, too slow
 * to do for every fund with a ticker set every time /assets renders.
 */
export async function getMasterFundComparison(
  assetId: string
): Promise<MasterFundCostResult | null> {
  const { accessToken, spreadsheetId } = await requireContext();
  const [assets, transactions, fundLog, prices] = await Promise.all([
    getAssets(accessToken, spreadsheetId),
    getTransactions(accessToken, spreadsheetId),
    getFundLog(accessToken, spreadsheetId),
    getPrices(accessToken, spreadsheetId),
  ]);
  const asset = assets.find((a) => a.id === assetId);
  if (
    !asset ||
    asset.type !== "fund" ||
    asset.currency !== "THB" ||
    asset.paysDividend ||
    !asset.masterFundTicker
  ) {
    return null;
  }

  return computeMasterFundImpliedCost(
    asset.masterFundTicker,
    asset.masterFundCurrency || "USD",
    fundLog.filter((f) => f.assetId === assetId),
    transactions.filter((t) => t.assetId === assetId),
    prices[assetId]?.price ?? 0
  );
}
