import { NextResponse } from "next/server";
import { authenticateCronRequest } from "@/lib/cronAuth";
import { runDailyPriceUpdate } from "@/lib/priceFetchJob";

/**
 * Unattended weekly portfolio snapshot, meant to be triggered by an
 * external scheduler (Vercel Cron). Fetches fresh prices and records a
 * snapshot + fundLog entry, same as clicking "บันทึกราคาและเก็บสแนปช็อตวันนี้"
 * by hand. Runs weekly rather than daily — Thai fund NAVs are published
 * with a multi-day lag, so a daily snapshot mostly just duplicates the
 * same values. The daily price refresh (/api/cron/fetch-prices) still
 * keeps the current-price cache fresh every day; this only affects how
 * often a new history point gets recorded.
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
