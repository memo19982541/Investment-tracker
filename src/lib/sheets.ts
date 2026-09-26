import { google } from "googleapis";

const SPREADSHEET_NAME = "Investment Tracker Data";

export const SHEET_TABS = {
  assets: [
    "id",
    "name",
    "type",
    "category",
    "currency",
    "createdAt",
    "order",
    "targetPct",
    "hidden",
    "masterFundTicker",
    "paysDividend",
    "masterFundCurrency",
  ],
  transactions: [
    "id",
    "date",
    "assetId",
    "type",
    "units",
    "pricePerUnit",
    "totalValue",
    "note",
    "createdAt",
  ],
  prices: ["assetId", "price", "updatedAt", "navDate"],
  snapshots: [
    "date",
    "currency",
    "totalValue",
    "totalCost",
    "byCategoryJson",
    "createdAt",
    "manual",
  ],
  fundLog: [
    "date",
    "assetId",
    "units",
    "price",
    "costPerUnit",
    "value",
    "costValue",
    "pnl",
    "createdAt",
  ],
} as const;

export type TabName = keyof typeof SHEET_TABS;

function getAuthClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return auth;
}

function getSheetsClient(accessToken: string) {
  return google.sheets({ version: "v4", auth: getAuthClient(accessToken) });
}

function getDriveClient(accessToken: string) {
  return google.drive({ version: "v3", auth: getAuthClient(accessToken) });
}

/**
 * Finds the user's data spreadsheet by name, or creates it (with all tabs
 * and header rows) the first time the app is used.
 */
export async function ensureSpreadsheet(accessToken: string): Promise<string> {
  const drive = getDriveClient(accessToken);

  const existing = await drive.files.list({
    q: `name='${SPREADSHEET_NAME}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    fields: "files(id, name)",
    spaces: "drive",
  });

  if (existing.data.files && existing.data.files.length > 0) {
    const spreadsheetId = existing.data.files[0].id!;
    await ensureTabs(accessToken, spreadsheetId);
    return spreadsheetId;
  }

  const sheetsApi = getSheetsClient(accessToken);
  const created = await sheetsApi.spreadsheets.create({
    requestBody: {
      properties: { title: SPREADSHEET_NAME },
      sheets: Object.keys(SHEET_TABS).map((title) => ({
        properties: { title },
      })),
    },
  });

  const spreadsheetId = created.data.spreadsheetId!;

  await sheetsApi.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: Object.entries(SHEET_TABS).map(([title, headers]) => ({
        range: `${title}!A1`,
        values: [headers as unknown as string[]],
      })),
    },
  });

  return spreadsheetId;
}

/**
 * Self-heals an existing spreadsheet against the current SHEET_TABS schema:
 * creates any tab that's missing entirely, and extends any tab whose header
 * row is shorter than the current definition (new columns are always added
 * at the end, so existing rows/columns never shift).
 */
export async function ensureTabs(accessToken: string, spreadsheetId: string) {
  const sheetsApi = getSheetsClient(accessToken);

  const meta = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });
  const existingTitles = new Set(
    (meta.data.sheets ?? []).map((s) => s.properties?.title ?? "")
  );

  const missing = Object.keys(SHEET_TABS).filter(
    (title) => !existingTitles.has(title)
  ) as TabName[];

  if (missing.length > 0) {
    await sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: missing.map((title) => ({ addSheet: { properties: { title } } })),
      },
    });
    await sheetsApi.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: missing.map((title) => ({
          range: `${title}!A1`,
          values: [SHEET_TABS[title] as unknown as string[]],
        })),
      },
    });
  }

  const existingTabs = (Object.keys(SHEET_TABS) as TabName[]).filter(
    (title) => !missing.includes(title)
  );
  if (existingTabs.length > 0) {
    const headerRes = await sheetsApi.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: existingTabs.map((title) => `${title}!A1:Z1`),
    });
    const updates: { range: string; values: string[][] }[] = [];
    existingTabs.forEach((title, i) => {
      const currentHeader = headerRes.data.valueRanges?.[i]?.values?.[0] ?? [];
      const expectedHeader = SHEET_TABS[title] as unknown as string[];
      if (currentHeader.length < expectedHeader.length) {
        updates.push({ range: `${title}!A1`, values: [expectedHeader] });
      }
    });
    if (updates.length > 0) {
      await sheetsApi.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: { valueInputOption: "RAW", data: updates },
      });
    }
  }
}

export async function readTable<T extends Record<string, string>>(
  accessToken: string,
  spreadsheetId: string,
  tab: TabName
): Promise<T[]> {
  const sheets = getSheetsClient(accessToken);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!A2:Z`,
  });
  const rows = res.data.values ?? [];
  const headers = SHEET_TABS[tab] as unknown as string[];
  return rows
    .filter((row) => row.some((cell) => cell !== undefined && cell !== ""))
    .map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => (obj[h] = row[i] ?? ""));
      return obj as T;
    });
}

export async function appendRow(
  accessToken: string,
  spreadsheetId: string,
  tab: TabName,
  rowObj: Record<string, string | number | boolean>
) {
  await appendRows(accessToken, spreadsheetId, tab, [rowObj]);
}

/** Appends many rows in a single API call — use this for bulk imports. */
export async function appendRows(
  accessToken: string,
  spreadsheetId: string,
  tab: TabName,
  rowObjs: Record<string, string | number | boolean>[]
) {
  if (rowObjs.length === 0) return;
  const sheets = getSheetsClient(accessToken);
  const headers = SHEET_TABS[tab] as unknown as string[];
  const values = rowObjs.map((rowObj) =>
    headers.map((h) => String(rowObj[h] ?? ""))
  );
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tab}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });
}

/**
 * Updates the row whose first column matches `keyValue` with the given
 * partial field updates, or appends a new row if no match exists.
 */
export async function upsertRowByKey(
  accessToken: string,
  spreadsheetId: string,
  tab: TabName,
  keyValue: string,
  updates: Record<string, string | number>
) {
  const sheets = getSheetsClient(accessToken);
  const headers = SHEET_TABS[tab] as unknown as string[];

  const keyColumnRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!A:A`,
  });
  const keyColumn = keyColumnRes.data.values ?? [];
  const rowIndex = keyColumn.findIndex((r) => r[0] === keyValue);

  if (rowIndex < 1) {
    await appendRow(accessToken, spreadsheetId, tab, {
      [headers[0]]: keyValue,
      ...updates,
    });
    return;
  }

  const rowNumber = rowIndex + 1; // 1-based sheet row number
  const currentRowRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!A${rowNumber}:Z${rowNumber}`,
  });
  const currentRow = currentRowRes.data.values?.[0] ?? [];
  const merged = headers.map((h, i) =>
    updates[h] !== undefined ? String(updates[h]) : currentRow[i] ?? ""
  );

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tab}!A${rowNumber}:Z${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [merged] },
  });
}

/** Deletes the row whose first column matches `keyValue`, if any. */
export async function deleteRowByKey(
  accessToken: string,
  spreadsheetId: string,
  tab: TabName,
  keyValue: string
) {
  const sheets = getSheetsClient(accessToken);

  const [meta, keyColumnRes] = await Promise.all([
    sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties(sheetId,title)",
    }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: `${tab}!A:A` }),
  ]);

  const sheetId = meta.data.sheets?.find(
    (s) => s.properties?.title === tab
  )?.properties?.sheetId;
  if (sheetId == null) return;

  const keyColumn = keyColumnRes.data.values ?? [];
  const rowIndex = keyColumn.findIndex((r) => r[0] === keyValue);
  if (rowIndex < 1) return; // not found, or header row

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  });
}

/** Deletes every row for which `predicate(row)` is true. */
export async function deleteRowsWhere(
  accessToken: string,
  spreadsheetId: string,
  tab: TabName,
  predicate: (row: string[]) => boolean
) {
  const sheets = getSheetsClient(accessToken);

  const [meta, dataRes] = await Promise.all([
    sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties(sheetId,title)",
    }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: `${tab}!A2:Z` }),
  ]);

  const sheetId = meta.data.sheets?.find(
    (s) => s.properties?.title === tab
  )?.properties?.sheetId;
  if (sheetId == null) return;

  const rows = dataRes.data.values ?? [];
  const matchingIndices: number[] = [];
  rows.forEach((row, i) => {
    if (predicate(row)) matchingIndices.push(i + 1); // +1: data starts at 0-based grid row 1
  });
  if (matchingIndices.length === 0) return;

  // Delete bottom-up within the same batch so earlier indices stay valid as
  // each deleteDimension request is applied.
  matchingIndices.sort((a, b) => b - a);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: matchingIndices.map((idx) => ({
        deleteDimension: {
          range: { sheetId, dimension: "ROWS", startIndex: idx, endIndex: idx + 1 },
        },
      })),
    },
  });
}
