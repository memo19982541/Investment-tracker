"use server";

import { revalidatePath } from "next/cache";
import { addHistoricalSnapshots, recomputeHistoricalSnapshots } from "@/lib/data";
import { requireContext } from "@/lib/session";

/** Last calendar day of each month from `fromMonth` (YYYY-MM) up to, but not including, `toMonth`. */
function monthEndDates(fromMonth: string, toMonth: string): string[] {
  const dates: string[] = [];
  let [y, m] = fromMonth.split("-").map(Number);
  const [toY, toM] = toMonth.split("-").map(Number);
  while (y < toY || (y === toY && m < toM)) {
    const lastDay = new Date(y, m, 0).getDate();
    dates.push(`${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return dates;
}

/**
 * Regenerates every stored snapshot/fundLog row from the current
 * transaction history. Needed after editing a past transaction (wrong
 * date, splitting a lump "current balance" entry into real dated
 * deposits, etc.) — snapshots are a write-once ledger, so a transaction
 * fix alone never changes what's already been recorded.
 */
export async function recomputeHistory() {
  const { accessToken, spreadsheetId } = await requireContext();
  const result = await recomputeHistoricalSnapshots(accessToken, spreadsheetId);

  revalidatePath("/");
  revalidatePath("/history");
  revalidatePath("/transactions");

  return result;
}

/**
 * Adds one monthly snapshot (month-end date) for every month from
 * `fromMonth` up to (not including) `toMonth`, filling in history earlier
 * than this app's own daily tracking — e.g. reaching back to before this
 * portfolio started being tracked day-by-day here, using each asset's own
 * settrade/Yahoo NAV history (see `backfillFundHistory`) for pricing.
 */
export async function addMonthlySnapshots(fromMonth: string, toMonth: string) {
  const { accessToken, spreadsheetId } = await requireContext();
  const dates = monthEndDates(fromMonth, toMonth);
  const result = await addHistoricalSnapshots(accessToken, spreadsheetId, dates);

  revalidatePath("/");
  revalidatePath("/history");

  return { ...result, monthsChecked: dates.length };
}
