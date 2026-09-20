import { NextResponse } from "next/server";
import { authenticateCronRequest } from "@/lib/cronAuth";
import { runFetchLatestPrices } from "@/lib/priceFetchJob";

/**
 * Unattended daily price refresh, meant to be triggered by an external
 * scheduler (Vercel Cron) — updates the "current price" cache only, no
 * snapshot. Runs daily since prices should stay fresh every day even
 * though Thai fund NAVs themselves only change every few days; snapshot
 * history is recorded separately, weekly, by /api/cron/weekly-snapshot.
 */
export async function GET(request: Request) {
  const auth = await authenticateCronRequest(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await runFetchLatestPrices(auth.accessToken, auth.spreadsheetId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
