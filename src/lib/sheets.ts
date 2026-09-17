import { google } from "googleapis";

const SPREADSHEET_NAME = "Investment Tracker Data";

export const SHEET_TABS = {
  assets: ["id", "name", "type", "category", "currency", "createdAt"],
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
  prices: ["assetId", "price", "updatedAt"],
  snapshots: ["date", "totalValue", "totalCost", "byCategoryJson", "createdAt"],
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
    return existing.data.files[0].id!;
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
  rowObj: Record<string, string | number>
) {
  const sheets = getSheetsClient(accessToken);
  const headers = SHEET_TABS[tab] as unknown as string[];
  const values = [headers.map((h) => String(rowObj[h] ?? ""))];
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
