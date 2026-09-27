import { NextResponse } from "next/server";
import { getSpreadsheetId } from "./data";
import { getAccessTokenFromRefreshToken } from "./googleAuth";

/**
 * Shared setup for unattended cron routes: checks the shared secret (since
 * there's no signed-in browser to check a session against), then resolves
 * an access token from the long-lived refresh token. Returns a Response to
 * send immediately on failure, or the resolved tokens to proceed with.
 */
export async function authenticateCronRequest(
  request: Request
): Promise<
  | { ok: true; accessToken: string; spreadsheetId: string }
  | { ok: false; response: NextResponse }
> {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!refreshToken) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "GOOGLE_REFRESH_TOKEN is not configured" },
        { status: 500 }
      ),
    };
  }

  try {
    const accessToken = await getAccessTokenFromRefreshToken(refreshToken);
    const spreadsheetId = await getSpreadsheetId(accessToken);
    return { ok: true, accessToken, spreadsheetId };
  } catch (err) {
    // Most commonly a refresh token that's expired or been revoked (e.g. a
    // Google OAuth app still in "Testing" mode issues refresh tokens that
    // stop working after ~7 days) — surfaced as JSON instead of an
    // uncaught crash (a bare 500 with no body) so it's diagnosable.
    return {
      ok: false,
      response: NextResponse.json(
        { error: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      ),
    };
  }
}
