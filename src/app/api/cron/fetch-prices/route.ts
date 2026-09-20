import { NextResponse } from "next/server";
import { authenticateCronRequest } from "@/lib/cronAuth";
import { runDailyPriceUpdate } from "@/lib/priceFetchJob";

/**
 * Unattended daily price update, meant to be triggered by an external
 * scheduler (Vercel Cron). Refreshes the current-price cache and records
 * today's snapshot/fundLog unconditionally, then prunes past snapshot rows
 * that aren't a keeper day (Wednesday/Saturday) or manually saved — see
 * `runDailyPriceUpdate`/`pruneNonKeeperSnapshots`.
 */
export async function GET(request: Request) {
  const auth = await authenticateCronRequest(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await runDailyPriceUpdate(auth.accessToken, auth.spreadsheetId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
