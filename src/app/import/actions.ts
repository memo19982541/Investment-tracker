"use server";

import { redirect } from "next/navigation";
import { addAssetsBulk, addTransactionsBulk, getAssets } from "@/lib/data";
import { requireContext } from "@/lib/session";
import { parseDateFlexible, splitRow } from "@/lib/parse";
import type { Asset, Transaction } from "@/lib/types";

const HEADER_WORDS = new Set([
  "ชื่อ",
  "name",
  "วันที่",
  "date",
]);

export async function importAssets(formData: FormData) {
  const { accessToken, spreadsheetId } = await requireContext();
  const raw = String(formData.get("data") ?? "");
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const existing = await getAssets(accessToken, spreadsheetId);
  const existingNames = new Set(existing.map((a) => a.name.toLowerCase()));

  const toCreate: Omit<Asset, "createdAt">[] = [];
  let skipped = 0;

  for (const line of lines) {
    const [name, type, category, currency] = splitRow(line);
    if (!name || HEADER_WORDS.has(name.toLowerCase())) continue;
    if (existingNames.has(name.toLowerCase())) {
      skipped++;
      continue;
    }
    toCreate.push({
      id: crypto.randomUUID(),
      name,
      type: type?.trim().toLowerCase() === "stock" ? "stock" : "fund",
      category: category?.trim() || "อื่นๆ",
      currency: currency?.trim().toUpperCase() === "USD" ? "USD" : "THB",
    });
    existingNames.add(name.toLowerCase());
  }

  if (toCreate.length > 0) {
    await addAssetsBulk(accessToken, spreadsheetId, toCreate);
  }

  redirect(
    `/import?assetsCreated=${toCreate.length}&assetsSkipped=${skipped}`
  );
}

export async function importTransactions(formData: FormData) {
  const { accessToken, spreadsheetId } = await requireContext();
  const raw = String(formData.get("data") ?? "");
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const assets = await getAssets(accessToken, spreadsheetId);
  const byName = new Map(assets.map((a) => [a.name.toLowerCase(), a]));

  const toCreate: Omit<Transaction, "id" | "createdAt">[] = [];
  const unmatched = new Set<string>();
  let invalid = 0;

  for (const line of lines) {
    const [dateRaw, name, typeRaw, unitsRaw, priceRaw] = splitRow(line);
    if (!dateRaw || HEADER_WORDS.has(dateRaw.toLowerCase())) continue;

    const asset = name ? byName.get(name.trim().toLowerCase()) : undefined;
    if (!asset) {
      if (name) unmatched.add(name);
      continue;
    }

    const units = Number(unitsRaw);
    const pricePerUnit = Number(priceRaw);
    if (!Number.isFinite(units) || !Number.isFinite(pricePerUnit) || units <= 0) {
      invalid++;
      continue;
    }

    const type: Transaction["type"] = /ขาย|sell/i.test(typeRaw ?? "")
      ? "sell"
      : "buy";

    toCreate.push({
      date: parseDateFlexible(dateRaw),
      assetId: asset.id,
      type,
      units,
      pricePerUnit,
      totalValue: units * pricePerUnit,
      note: "",
    });
  }

  if (toCreate.length > 0) {
    await addTransactionsBulk(accessToken, spreadsheetId, toCreate);
  }

  const unmatchedParam = encodeURIComponent([...unmatched].join(", "));
  redirect(
    `/import?txCreated=${toCreate.length}&txInvalid=${invalid}&txUnmatched=${unmatchedParam}`
  );
}
