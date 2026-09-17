/** Splits a pasted spreadsheet row by tab (Google Sheets paste) or comma (CSV). */
export function splitRow(line: string): string[] {
  const cols = line.includes("\t") ? line.split("\t") : line.split(",");
  return cols.map((c) => c.trim());
}

/** Parses D/M/YYYY (Thai sheet format) or YYYY-MM-DD into YYYY-MM-DD. */
export function parseDateFlexible(input: string): string {
  const s = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return s;
}
