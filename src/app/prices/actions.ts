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
import type { Currency } from "@/lib/types";

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
  const holdings = computeHoldings(assets, transactions, prices).filter(
    (h) => h.units > 0.0001
  );

  const byCurrency = new Map<
    Currency,
    Record<string, { value: number; cost: number }>
  >();
  const totals = new Map<Currency, { value: number; cost: number }>();

  for (const h of holdings) {
    const currency = h.asset.currency;
    const cats = byCurrency.get(currency) ?? {};
    const cat = cats[h.asset.category] ?? { value: 0, cost: 0 };
    cat.value += h.currentValue;
    cat.cost += h.cost;
    cats[h.asset.category] = cat;
    byCurrency.set(currency, cats);

    const total = totals.get(currency) ?? { value: 0, cost: 0 };
    total.value += h.currentValue;
    total.cost += h.cost;
    totals.set(currency, total);
  }

  const date = new Date().toISOString().slice(0, 10);
  for (const [currency, total] of totals) {
    await addSnapshot(accessToken, spreadsheetId, {
      date,
      currency,
      totalValue: total.value,
      totalCost: total.cost,
      byCategoryJson: JSON.stringify(byCurrency.get(currency) ?? {}),
    });
  }

  revalidatePath("/prices");
  revalidatePath("/");
  revalidatePath("/history");
}
