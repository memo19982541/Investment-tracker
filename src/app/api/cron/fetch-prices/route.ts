import { NextResponse } from "next/server";
import { authenticateCronRequest } from "@/lib/cronAuth";
import { runDailyPriceUpdate } from "@/lib/priceFetchJob";

/**
 * Unattended daily price update, meant to be triggered by an external
 * scheduler (Vercel Cron). Always refreshes the current-price cache; only
 * records a new snapshot/fundLog history point if something actually
 * changed since the last one (see `recordSnapshotAndFundLogIfChanged`) —
 * avoids piling up duplicate points on days a Thai fund's NAV hasn't been
 * republished yet, while still catching every real price or portfolio
 * change (e.g. a US stock moving, or a transaction being entered).
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
