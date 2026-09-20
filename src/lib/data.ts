import {
  appendRow,
  appendRows,
  deleteRowByKey,
  deleteRowsWhere,
  ensureSpreadsheet,
  readTable,
  upsertRowByKey,
} from "./sheets";
import type {
  Asset,
  FundLogEntry,
  Holding,
  PriceEntry,
  Snapshot,
  Transaction,
} from "./types";

export async function getSpreadsheetId(accessToken: string) {
  return ensureSpreadsheet(accessToken);
}

export async function getAssets(accessToken: string, spreadsheetId: string) {
  const rows = await readTable<Record<string, string>>(
    accessToken,
    spreadsheetId,
    "assets"
  );
  return rows.map(
    (r): Asset => ({
      id: r.id,
      name: r.name,
      type: r.type as Asset["type"],
      category: r.category,
      currency: r.currency as Asset["currency"],
      createdAt: r.createdAt,
      order: r.order !== "" ? Number(r.order) : undefined,
      targetPct: r.targetPct !== "" ? Number(r.targetPct) : undefined,
      hidden: r.hidden === "true",
    })
  );
}

/** Sorts assets for display: by explicit `order` first, then by creation date. */
export function sortAssetsForDisplay(assets: Asset[]): Asset[] {
  return [...assets].sort((a, b) => {
    const oa = a.order ?? Number.MAX_SAFE_INTEGER;
    const ob = b.order ?? Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export async function updateAssetMeta(
  accessToken: string,
  spreadsheetId: string,
  assetId: string,
  updates: { order?: number; targetPct?: number | null; hidden?: boolean }
) {
  const payload: Record<string, string | number> = {};
  if (updates.order !== undefined) payload.order = updates.order;
  if (updates.targetPct !== undefined) {
    payload.targetPct = updates.targetPct === null ? "" : updates.targetPct;
  }
  if (updates.hidden !== undefined) payload.hidden = updates.hidden ? "true" : "false";
  await upsertRowByKey(accessToken, spreadsheetId, "assets", assetId, payload);
}

export async function addAsset(
  accessToken: string,
  spreadsheetId: string,
  asset: Omit<Asset, "createdAt">
) {
  await appendRow(accessToken, spreadsheetId, "assets", {
    ...asset,
    createdAt: new Date().toISOString(),
  });
}

export async function deleteAsset(
  accessToken: string,
  spreadsheetId: string,
  assetId: string
) {
  await deleteRowByKey(accessToken, spreadsheetId, "assets", assetId);
}

export async function addAssetsBulk(
  accessToken: string,
  spreadsheetId: string,
  assets: Omit<Asset, "createdAt">[]
) {
  const createdAt = new Date().toISOString();
  await appendRows(
    accessToken,
    spreadsheetId,
    "assets",
    assets.map((a) => ({ ...a, createdAt }))
  );
}

export async function getTransactions(
  accessToken: string,
  spreadsheetId: string
) {
  const rows = await readTable<Record<string, string>>(
    accessToken,
    spreadsheetId,
    "transactions"
  );
  return rows.map(
    (r): Transaction => ({
      id: r.id,
      date: r.date,
      assetId: r.assetId,
      type: r.type as Transaction["type"],
      units: Number(r.units),
      pricePerUnit: Number(r.pricePerUnit),
      totalValue: Number(r.totalValue),
      note: r.note,
      createdAt: r.createdAt,
    })
  );
}

export async function addTransaction(
  accessToken: string,
  spreadsheetId: string,
  tx: Omit<Transaction, "id" | "createdAt">
) {
  await appendRow(accessToken, spreadsheetId, "transactions", {
    ...tx,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  });
}

export async function addTransactionsBulk(
  accessToken: string,
  spreadsheetId: string,
  txs: Omit<Transaction, "id" | "createdAt">[]
) {
  const createdAt = new Date().toISOString();
  await appendRows(
    accessToken,
    spreadsheetId,
    "transactions",
    txs.map((t) => ({ ...t, id: crypto.randomUUID(), createdAt }))
  );
}

export async function deleteTransaction(
  accessToken: string,
  spreadsheetId: string,
  transactionId: string
) {
  await deleteRowByKey(accessToken, spreadsheetId, "transactions", transactionId);
}

export async function deleteTransactionsByAsset(
  accessToken: string,
  spreadsheetId: string,
  assetId: string
) {
  await deleteRowsWhere(
    accessToken,
    spreadsheetId,
    "transactions",
    (row) => row[2] === assetId
  );
}

export async function deleteFundLogRowsByKeys(
  accessToken: string,
  spreadsheetId: string,
  keys: { date: string; assetId: string }[]
) {
  const keySet = new Set(keys.map((k) => `${k.date}|${k.assetId}`));
  await deleteRowsWhere(
    accessToken,
    spreadsheetId,
    "fundLog",
    (row) => keySet.has(`${row[0]}|${row[1]}`)
  );
}

export async function getPrices(accessToken: string, spreadsheetId: string) {
  const rows = await readTable<Record<string, string>>(
    accessToken,
    spreadsheetId,
    "prices"
  );
  const byAssetId: Record<string, PriceEntry> = {};
  for (const r of rows) {
    byAssetId[r.assetId] = {
      assetId: r.assetId,
      price: Number(r.price),
      updatedAt: r.updatedAt,
      navDate: r.navDate || undefined,
    };
  }
  return byAssetId;
}

export async function setPrice(
  accessToken: string,
  spreadsheetId: string,
  assetId: string,
  price: number,
  navDate?: string
) {
  await upsertRowByKey(accessToken, spreadsheetId, "prices", assetId, {
    price,
    updatedAt: new Date().toISOString(),
    ...(navDate ? { navDate } : {}),
  });
}

export async function getSnapshots(
  accessToken: string,
  spreadsheetId: string
) {
  const rows = await readTable<Record<string, string>>(
    accessToken,
    spreadsheetId,
    "snapshots"
  );
  return rows.map(
    (r): Snapshot => ({
      date: r.date,
      currency: (r.currency || "THB") as Snapshot["currency"],
      totalValue: Number(r.totalValue),
      totalCost: Number(r.totalCost),
      byCategoryJson: r.byCategoryJson,
      createdAt: r.createdAt,
    })
  );
}

export async function addSnapshot(
  accessToken: string,
  spreadsheetId: string,
  snapshot: Omit<Snapshot, "createdAt">
) {
  await appendRow(accessToken, spreadsheetId, "snapshots", {
    ...snapshot,
    createdAt: new Date().toISOString(),
  });
}

export async function addSnapshotsBulk(
  accessToken: string,
  spreadsheetId: string,
  snapshots: Omit<Snapshot, "createdAt">[]
) {
  const createdAt = new Date().toISOString();
  await appendRows(
    accessToken,
    spreadsheetId,
    "snapshots",
    snapshots.map((s) => ({ ...s, createdAt }))
  );
}

export async function getFundLog(accessToken: string, spreadsheetId: string) {
  const rows = await readTable<Record<string, string>>(
    accessToken,
    spreadsheetId,
    "fundLog"
  );
  return rows.map(
    (r): FundLogEntry => ({
      date: r.date,
      assetId: r.assetId,
      units: Number(r.units),
      price: Number(r.price),
      costPerUnit: Number(r.costPerUnit),
      value: Number(r.value),
      costValue: Number(r.costValue),
      pnl: Number(r.pnl),
      createdAt: r.createdAt,
    })
  );
}

export async function appendFundLogRows(
  accessToken: string,
  spreadsheetId: string,
  rows: Omit<FundLogEntry, "createdAt">[]
) {
  const createdAt = new Date().toISOString();
  await appendRows(
    accessToken,
    spreadsheetId,
    "fundLog",
    rows.map((r) => ({ ...r, createdAt }))
  );
}

/**
 * Records today's portfolio snapshot (total value/cost per currency, with
 * category breakdown) plus a fundLog row per holding — the shared write
 * path used by both manual price entry and the auto NAV fetch, so fund-level
 * history accumulates no matter which one last updated prices.
 */
export async function recordSnapshotAndFundLog(
  accessToken: string,
  spreadsheetId: string,
  assets: Asset[],
  transactions: Transaction[],
  prices: Record<string, PriceEntry>
) {
  const allHoldings = computeHoldings(assets, transactions, prices);
  const heldHoldings = allHoldings.filter((h) => h.units > 0.0001);

  const byCurrency = new Map<
    Snapshot["currency"],
    Record<string, { value: number; cost: number }>
  >();
  const totals = new Map<Snapshot["currency"], { value: number; cost: number }>();

  for (const h of heldHoldings) {
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

  // Replace any snapshot/fundLog rows already recorded today, so saving more
  // than once in the same day updates today's entry instead of piling up
  // duplicate history points.
  await Promise.all([
    deleteRowsWhere(accessToken, spreadsheetId, "snapshots", (row) => row[0] === date),
    deleteRowsWhere(accessToken, spreadsheetId, "fundLog", (row) => row[0] === date),
  ]);

  for (const [currency, total] of totals) {
    await addSnapshot(accessToken, spreadsheetId, {
      date,
      currency,
      totalValue: total.value,
      totalCost: total.cost,
      byCategoryJson: JSON.stringify(byCurrency.get(currency) ?? {}),
    });
  }

  // Log every asset's price/units every day, not just currently-held ones —
  // a fund sold down to zero still needs its NAV tracked going forward so
  // the no-trade comparison can keep revaluing the units frozen at baseline
  // instead of falling back to a stale price.
  await appendFundLogRows(
    accessToken,
    spreadsheetId,
    allHoldings.map((h) => ({
      date,
      assetId: h.asset.id,
      units: h.units,
      price: h.price,
      costPerUnit: h.units > 0 ? h.cost / h.units : 0,
      value: h.currentValue,
      costValue: h.cost,
      pnl: h.pnl,
    }))
  );
}

const SNAPSHOT_CHANGE_EPSILON = 0.01;

/**
 * Like `recordSnapshotAndFundLog`, but skips writing anything if today's
 * per-currency totals are identical (within a cent) to the most recent
 * prior snapshot — used by the daily cron so it doesn't pile up duplicate
 * history points on days a Thai fund's NAV hasn't actually been
 * republished yet. The manual "save snapshot" button on /prices always
 * calls `recordSnapshotAndFundLog` directly and writes unconditionally,
 * since clicking it is itself a signal the user wants a checkpoint.
 */
export async function recordSnapshotAndFundLogIfChanged(
  accessToken: string,
  spreadsheetId: string,
  assets: Asset[],
  transactions: Transaction[],
  prices: Record<string, PriceEntry>
): Promise<{ recorded: boolean }> {
  const heldHoldings = computeHoldings(assets, transactions, prices).filter(
    (h) => h.units > 0.0001
  );

  const totals = new Map<Snapshot["currency"], number>();
  for (const h of heldHoldings) {
    const currency = h.asset.currency;
    totals.set(currency, (totals.get(currency) ?? 0) + h.currentValue);
  }

  const today = new Date().toISOString().slice(0, 10);
  const existingSnapshots = await getSnapshots(accessToken, spreadsheetId);
  const latestByCurrency = new Map<Snapshot["currency"], Snapshot>();
  for (const s of existingSnapshots) {
    if (s.date >= today) continue;
    const prev = latestByCurrency.get(s.currency);
    if (!prev || s.date > prev.date) latestByCurrency.set(s.currency, s);
  }

  const anyChanged = [...totals.entries()].some(([currency, value]) => {
    const prev = latestByCurrency.get(currency);
    if (!prev) return true;
    return Math.abs(prev.totalValue - value) > SNAPSHOT_CHANGE_EPSILON;
  });

  if (!anyChanged) return { recorded: false };

  await recordSnapshotAndFundLog(accessToken, spreadsheetId, assets, transactions, prices);
  return { recorded: true };
}

/**
 * Regenerates every existing snapshots/fundLog row from the current
 * transaction history, keeping each date's own recorded prices (from its
 * existing fundLog rows) but recomputing units/cost as of that date.
 *
 * `snapshots`/`fundLog` are a write-once historical ledger, not a view
 * computed live from `transactions` — editing a past transaction (fixing a
 * wrong date, splitting a lump "current balance" entry into real dated
 * deposits, etc.) does not retroactively change any snapshot already
 * written. This replays history as it would have been recorded had the
 * corrected transactions been in place from the start, so a data-entry fix
 * actually propagates into the no-trade baseline and every other view that
 * reads historical snapshots instead of only affecting `computeHoldings`'s
 * live "today" view.
 *
 * Assets with zero transactions ever (e.g. a manually-imported placeholder
 * like "cash + other funds, backfilled" that has real historical fundLog
 * values but was never meant to be replayed from a transaction ledger) are
 * left completely alone — their existing fundLog rows are neither deleted
 * nor recomputed, and their existing value/cost at each date is carried
 * into the regenerated snapshot totals as-is. Recomputing them from
 * `transactions` would silently zero them out instead.
 */
export async function recomputeHistoricalSnapshots(
  accessToken: string,
  spreadsheetId: string
) {
  const [assets, transactions, fundLog, snapshots] = await Promise.all([
    getAssets(accessToken, spreadsheetId),
    getTransactions(accessToken, spreadsheetId),
    getFundLog(accessToken, spreadsheetId),
    getSnapshots(accessToken, spreadsheetId),
  ]);

  const priceByAssetDate = new Map<string, Map<string, number>>();
  const existingLogByAssetDate = new Map<string, FundLogEntry>();
  for (const f of fundLog) {
    const m = priceByAssetDate.get(f.assetId) ?? new Map<string, number>();
    m.set(f.date, f.price);
    priceByAssetDate.set(f.assetId, m);
    existingLogByAssetDate.set(`${f.assetId}|${f.date}`, f);
  }

  const txByAsset = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const arr = txByAsset.get(t.assetId) ?? [];
    arr.push(t);
    txByAsset.set(t.assetId, arr);
  }
  for (const arr of txByAsset.values()) arr.sort((a, b) => a.date.localeCompare(b.date));
  const assetIdsWithTx = new Set(transactions.map((t) => t.assetId));

  const dateKeys = [...new Set(snapshots.map((s) => `${s.date}|${s.currency}`))].sort();

  const newSnapshots: Omit<Snapshot, "createdAt">[] = [];
  const newFundLogRows: Omit<FundLogEntry, "createdAt">[] = [];
  const replacedKeys: string[] = [];

  for (const key of dateKeys) {
    const [date, currency] = key.split("|") as [string, Snapshot["currency"]];
    const byCategory: Record<string, { value: number; cost: number }> = {};
    let totalValue = 0;
    let totalCost = 0;

    for (const asset of assets) {
      if (asset.currency !== currency) continue;

      if (!assetIdsWithTx.has(asset.id)) {
        const existing = existingLogByAssetDate.get(`${asset.id}|${date}`);
        if (!existing) continue;
        totalValue += existing.value;
        totalCost += existing.costValue;
        const cat = byCategory[asset.category] ?? { value: 0, cost: 0 };
        cat.value += existing.value;
        cat.cost += existing.costValue;
        byCategory[asset.category] = cat;
        continue;
      }

      const assetTx = (txByAsset.get(asset.id) ?? []).filter((t) => t.date <= date);

      let units = 0;
      let cost = 0;
      for (const t of assetTx) {
        if (t.type === "buy") {
          units += t.units;
          cost += t.totalValue;
        } else {
          const avgCost = units > 0 ? cost / units : 0;
          units -= t.units;
          cost -= avgCost * t.units;
        }
      }
      units = Math.max(units, 0);
      cost = Math.max(cost, 0);
      if (units <= 0.0001) continue;

      const price =
        asset.type === "cash" ? 1 : priceByAssetDate.get(asset.id)?.get(date);
      if (price === undefined) continue;

      const value = units * price;
      totalValue += value;
      totalCost += cost;
      const cat = byCategory[asset.category] ?? { value: 0, cost: 0 };
      cat.value += value;
      cat.cost += cost;
      byCategory[asset.category] = cat;

      replacedKeys.push(`${asset.id}|${date}`);
      newFundLogRows.push({
        date,
        assetId: asset.id,
        units,
        price,
        costPerUnit: units > 0 ? cost / units : 0,
        value,
        costValue: cost,
        pnl: value - cost,
      });
    }

    newSnapshots.push({
      date,
      currency,
      totalValue,
      totalCost,
      byCategoryJson: JSON.stringify(byCategory),
    });
  }

  const dateSet = new Set(dateKeys);
  const replacedKeySet = new Set(replacedKeys);
  await Promise.all([
    deleteRowsWhere(accessToken, spreadsheetId, "snapshots", (row) =>
      dateSet.has(`${row[0]}|${row[1]}`)
    ),
    deleteRowsWhere(accessToken, spreadsheetId, "fundLog", (row) =>
      replacedKeySet.has(`${row[1]}|${row[0]}`)
    ),
  ]);
  await Promise.all([
    addSnapshotsBulk(accessToken, spreadsheetId, newSnapshots),
    appendFundLogRows(accessToken, spreadsheetId, newFundLogRows),
  ]);

  return { snapshotsUpdated: newSnapshots.length, fundLogRowsUpdated: newFundLogRows.length };
}

/**
 * Adds a snapshot (+ fundLog rows) for each given date that doesn't already
 * have one, for both currencies — used to extend history earlier than
 * this app's own daily tracking (e.g. monthly points reaching back before
 * the first real snapshot). Unlike `recomputeHistoricalSnapshots`, prices
 * are looked up as "the most recent fundLog price on or before that date"
 * per asset rather than requiring an exact match, since a chosen date (a
 * month-end) won't usually land on the exact day settrade/Yahoo happened
 * to record a NAV/close for every asset. Never touches an existing
 * snapshot date.
 */
export async function addHistoricalSnapshots(
  accessToken: string,
  spreadsheetId: string,
  targetDates: string[]
) {
  const [assets, transactions, fundLog, existingSnapshots] = await Promise.all([
    getAssets(accessToken, spreadsheetId),
    getTransactions(accessToken, spreadsheetId),
    getFundLog(accessToken, spreadsheetId),
    getSnapshots(accessToken, spreadsheetId),
  ]);

  const logByAsset = new Map<string, FundLogEntry[]>();
  for (const f of fundLog) {
    const arr = logByAsset.get(f.assetId) ?? [];
    arr.push(f);
    logByAsset.set(f.assetId, arr);
  }
  for (const arr of logByAsset.values()) arr.sort((a, b) => a.date.localeCompare(b.date));

  function priceAsOf(assetId: string, date: string): number | undefined {
    const arr = logByAsset.get(assetId);
    if (!arr) return undefined;
    let result: number | undefined;
    for (const p of arr) {
      if (p.date > date) break;
      result = p.price;
    }
    return result;
  }

  /** For an asset with no transactions (a manually-curated placeholder) —
   * its last known fundLog entry on or before `date`, carried forward as-is
   * rather than replayed from a (nonexistent) transaction history. */
  function logAsOf(assetId: string, date: string): FundLogEntry | undefined {
    const arr = logByAsset.get(assetId);
    if (!arr) return undefined;
    let result: FundLogEntry | undefined;
    for (const p of arr) {
      if (p.date > date) break;
      result = p;
    }
    return result;
  }

  const txByAsset = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const arr = txByAsset.get(t.assetId) ?? [];
    arr.push(t);
    txByAsset.set(t.assetId, arr);
  }
  for (const arr of txByAsset.values()) arr.sort((a, b) => a.date.localeCompare(b.date));
  const assetIdsWithTx = new Set(transactions.map((t) => t.assetId));

  const existingKeys = new Set(
    existingSnapshots.map((s) => `${s.date}|${s.currency}`)
  );
  const currencies: Snapshot["currency"][] = ["THB", "USD"];

  const newSnapshots: Omit<Snapshot, "createdAt">[] = [];
  const newFundLogRows: Omit<FundLogEntry, "createdAt">[] = [];

  for (const date of [...new Set(targetDates)].sort()) {
    for (const currency of currencies) {
      if (existingKeys.has(`${date}|${currency}`)) continue;

      const byCategory: Record<string, { value: number; cost: number }> = {};
      let totalValue = 0;
      let totalCost = 0;
      let anyHeld = false;

      for (const asset of assets) {
        if (asset.currency !== currency) continue;

        if (!assetIdsWithTx.has(asset.id)) {
          const carried = logAsOf(asset.id, date);
          if (!carried) continue;
          anyHeld = true;
          totalValue += carried.value;
          totalCost += carried.costValue;
          const cat = byCategory[asset.category] ?? { value: 0, cost: 0 };
          cat.value += carried.value;
          cat.cost += carried.costValue;
          byCategory[asset.category] = cat;
          continue;
        }

        const assetTx = (txByAsset.get(asset.id) ?? []).filter((t) => t.date <= date);

        let units = 0;
        let cost = 0;
        for (const t of assetTx) {
          if (t.type === "buy") {
            units += t.units;
            cost += t.totalValue;
          } else {
            const avgCost = units > 0 ? cost / units : 0;
            units -= t.units;
            cost -= avgCost * t.units;
          }
        }
        units = Math.max(units, 0);
        cost = Math.max(cost, 0);
        if (units <= 0.0001) continue;

        const price = asset.type === "cash" ? 1 : priceAsOf(asset.id, date);
        if (price === undefined) continue;

        anyHeld = true;
        const value = units * price;
        totalValue += value;
        totalCost += cost;
        const cat = byCategory[asset.category] ?? { value: 0, cost: 0 };
        cat.value += value;
        cat.cost += cost;
        byCategory[asset.category] = cat;

        newFundLogRows.push({
          date,
          assetId: asset.id,
          units,
          price,
          costPerUnit: units > 0 ? cost / units : 0,
          value,
          costValue: cost,
          pnl: value - cost,
        });
      }

      if (!anyHeld) continue;
      newSnapshots.push({
        date,
        currency,
        totalValue,
        totalCost,
        byCategoryJson: JSON.stringify(byCategory),
      });
    }
  }

  if (newSnapshots.length > 0) {
    await addSnapshotsBulk(accessToken, spreadsheetId, newSnapshots);
  }
  if (newFundLogRows.length > 0) {
    await appendFundLogRows(accessToken, spreadsheetId, newFundLogRows);
  }

  return { snapshotsAdded: newSnapshots.length, fundLogRowsAdded: newFundLogRows.length };
}

/**
 * Computes per-asset holdings (units, average cost, current value, P/L)
 * from the full transaction history, using the average-cost method.
 */
export function computeHoldings(
  assets: Asset[],
  transactions: Transaction[],
  prices: Record<string, PriceEntry>
): Holding[] {
  return assets.map((asset) => {
    const assetTx = transactions
      .filter((t) => t.assetId === asset.id)
      .sort((a, b) => a.date.localeCompare(b.date));

    let units = 0;
    let cost = 0;
    for (const t of assetTx) {
      if (t.type === "buy") {
        units += t.units;
        cost += t.totalValue;
      } else {
        const avgCost = units > 0 ? cost / units : 0;
        units -= t.units;
        cost -= avgCost * t.units;
      }
    }
    units = Math.max(units, 0);
    cost = Math.max(cost, 0);

    // Cash has no NAV to track — 1 unit is always worth 1 currency unit.
    const price = asset.type === "cash" ? 1 : (prices[asset.id]?.price ?? 0);
    const currentValue = units * price;
    const pnl = currentValue - cost;
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;

    return { asset, units, cost, price, currentValue, pnl, pnlPct };
  });
}
