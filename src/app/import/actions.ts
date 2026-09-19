"use server";

import { redirect } from "next/navigation";
import {
  addAssetsBulk,
  addTransactionsBulk,
  addSnapshotsBulk,
  appendFundLogRows,
  deleteFundLogRowsByKeys,
  getAssets,
  getFundLog,
  getSnapshots,
} from "@/lib/data";
import { requireContext } from "@/lib/session";
import { parseDateFlexible, parseNumber, splitRow } from "@/lib/parse";
import type { Asset, FundLogEntry, Snapshot, Transaction } from "@/lib/types";

const HEADER_WORDS = new Set([
  "ชื่อ",
  "name",
  "วันที่",
  "date",
  "วันที่บันทึก",
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

    const units = parseNumber(unitsRaw);
    const pricePerUnit = parseNumber(priceRaw);
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

/**
 * Backfills fundLog (per-fund value history) from a "บันทึกหน่วยกองทุน"-shaped
 * paste. A pasted row always wins over whatever's already stored for that
 * date — this is meant for pasting the reference sheet's own record, which
 * is ground truth, so a same-date row already in fundLog (e.g. written by
 * this app's own, possibly-wrong, transaction-derived guess) gets replaced
 * rather than silently kept.
 */
export async function importFundLog(formData: FormData) {
  const { accessToken, spreadsheetId } = await requireContext();
  const raw = String(formData.get("data") ?? "");
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const [assets, existingLog] = await Promise.all([
    getAssets(accessToken, spreadsheetId),
    getFundLog(accessToken, spreadsheetId),
  ]);
  const byName = new Map(assets.map((a) => [a.name.toLowerCase(), a]));
  const existingKeys = new Set(existingLog.map((r) => `${r.date}|${r.assetId}`));

  const toCreate: Omit<FundLogEntry, "createdAt">[] = [];
  const toOverwrite: { date: string; assetId: string }[] = [];
  const unmatched = new Set<string>();
  let invalid = 0;
  let overwritten = 0;

  for (const line of lines) {
    const [dateRaw, name, unitsRaw, priceRaw, costPerUnitRaw, valueRaw, costValueRaw, pnlRaw] =
      splitRow(line);
    if (!dateRaw || HEADER_WORDS.has(dateRaw.toLowerCase())) continue;

    const asset = name ? byName.get(name.trim().toLowerCase()) : undefined;
    if (!asset) {
      if (name) unmatched.add(name);
      continue;
    }

    const units = parseNumber(unitsRaw);
    const price = parseNumber(priceRaw);
    const costPerUnit = parseNumber(costPerUnitRaw);
    const value = parseNumber(valueRaw);
    const costValue = parseNumber(costValueRaw);
    const pnl = parseNumber(pnlRaw);
    if (
      ![units, price, costPerUnit, value, costValue, pnl].every(Number.isFinite)
    ) {
      invalid++;
      continue;
    }

    const date = parseDateFlexible(dateRaw);
    const key = `${date}|${asset.id}`;
    if (existingKeys.has(key)) {
      overwritten++;
      toOverwrite.push({ date, assetId: asset.id });
    }

    toCreate.push({ date, assetId: asset.id, units, price, costPerUnit, value, costValue, pnl });
  }

  if (toOverwrite.length > 0) {
    await deleteFundLogRowsByKeys(accessToken, spreadsheetId, toOverwrite);
  }
  if (toCreate.length > 0) {
    await appendFundLogRows(accessToken, spreadsheetId, toCreate);
  }

  const unmatchedParam = encodeURIComponent([...unmatched].join(", "));
  redirect(
    `/import?flCreated=${toCreate.length - overwritten}&flOverwritten=${overwritten}&flInvalid=${invalid}&flUnmatched=${unmatchedParam}`
  );
}

/**
 * Backfills portfolio-value snapshots from a "บันทึกข้อมูล"-shaped paste:
 * date, total value, total cost, then one value per category in the fixed
 * order CORE, Cash, Future, Gold (this app's default categories).
 */
export async function importSnapshots(formData: FormData) {
  const { accessToken, spreadsheetId } = await requireContext();
  const raw = String(formData.get("data") ?? "");
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const existing = await getSnapshots(accessToken, spreadsheetId);
  const existingKeys = new Set(existing.map((s) => `${s.date}|${s.currency}`));

  const CATEGORY_ORDER = ["CORE", "Cash", "Future", "Gold"];
  const toCreate: Omit<Snapshot, "createdAt">[] = [];
  let invalid = 0;
  let duplicate = 0;

  for (const line of lines) {
    const [dateRaw, totalValueRaw, totalCostRaw, ...categoryVals] = splitRow(line);
    if (!dateRaw || HEADER_WORDS.has(dateRaw.toLowerCase())) continue;

    const totalValue = parseNumber(totalValueRaw);
    const totalCost = parseNumber(totalCostRaw);
    if (!Number.isFinite(totalValue) || !Number.isFinite(totalCost)) {
      invalid++;
      continue;
    }

    const date = parseDateFlexible(dateRaw);
    const key = `${date}|THB`;
    if (existingKeys.has(key)) {
      duplicate++;
      continue;
    }
    existingKeys.add(key);

    const byCategory: Record<string, { value: number; cost: number }> = {};
    CATEGORY_ORDER.forEach((cat, i) => {
      const v = parseNumber(categoryVals[i]);
      if (Number.isFinite(v) && v !== 0) byCategory[cat] = { value: v, cost: 0 };
    });

    toCreate.push({
      date,
      currency: "THB",
      totalValue,
      totalCost,
      byCategoryJson: JSON.stringify(byCategory),
    });
  }

  if (toCreate.length > 0) {
    await addSnapshotsBulk(accessToken, spreadsheetId, toCreate);
  }

  redirect(
    `/import?snCreated=${toCreate.length}&snInvalid=${invalid}&snDuplicate=${duplicate}`
  );
}
