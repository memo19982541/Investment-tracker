import { NextResponse } from "next/server";
import { getSpreadsheetId } from "@/lib/data";
import { getAccessTokenFromRefreshToken } from "@/lib/googleAuth";
import { runDailyPriceUpdate } from "@/lib/priceFetchJob";

/**
 * Unattended daily price update, meant to be triggered by an external
 * scheduler (Windows Task Scheduler locally, or Vercel Cron once deployed)
 * — not by a signed-in browser, so it authenticates via a long-lived
 * refresh token instead of a session, and checks a shared secret instead of
 * a login.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!refreshToken) {
    return NextResponse.json(
      { error: "GOOGLE_REFRESH_TOKEN is not configured" },
      { status: 500 }
    );
  }

  try {
    const accessToken = await getAccessTokenFromRefreshToken(refreshToken);
    const spreadsheetId = await getSpreadsheetId(accessToken);
    const result = await runDailyPriceUpdate(accessToken, spreadsheetId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
