import {
  appendRow,
  appendRows,
  ensureSpreadsheet,
  readTable,
  upsertRowByKey,
} from "./sheets";
import type {
  Asset,
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
    })
  );
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
    };
  }
  return byAssetId;
}

export async function setPrice(
  accessToken: string,
  spreadsheetId: string,
  assetId: string,
  price: number
) {
  await upsertRowByKey(accessToken, spreadsheetId, "prices", assetId, {
    price,
    updatedAt: new Date().toISOString(),
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

    const price = prices[asset.id]?.price ?? 0;
    const currentValue = units * price;
    const pnl = currentValue - cost;
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;

    return { asset, units, cost, price, currentValue, pnl, pnlPct };
  });
}
