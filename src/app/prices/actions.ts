"use server";

import { revalidatePath } from "next/cache";
import {
  addSnapshot,
  computeHoldings,
  getAssets,
  getPrices,
  getTransactions,
  setPrice,
} from "@/lib/data";
import { requireContext } from "@/lib/session";

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
  const holdings = computeHoldings(assets, transactions, prices);

  const byCategory: Record<string, { value: number; cost: number }> = {};
  for (const h of holdings) {
    const cur = byCategory[h.asset.category] ?? { value: 0, cost: 0 };
    cur.value += h.currentValue;
    cur.cost += h.cost;
    byCategory[h.asset.category] = cur;
  }
  const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0);
  const totalCost = holdings.reduce((s, h) => s + h.cost, 0);

  await addSnapshot(accessToken, spreadsheetId, {
    date: new Date().toISOString().slice(0, 10),
    totalValue,
    totalCost,
    byCategoryJson: JSON.stringify(byCategory),
  });

  revalidatePath("/prices");
  revalidatePath("/");
  revalidatePath("/history");
}
