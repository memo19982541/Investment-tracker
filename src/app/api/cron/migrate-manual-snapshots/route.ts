import { NextResponse } from "next/server";
import { authenticateCronRequest } from "@/lib/cronAuth";
import { markHistoricalSnapshotsManual } from "@/lib/data";

/**
 * TEMPORARY one-time migration route — delete this file after running it
 * once. Marks every snapshot dated on or before the given cutoff (default
 * 2026-09-18) as `manual: true`, so `pruneNonKeeperSnapshots` never deletes
 * history recorded before the weekend-retention pruning feature existed.
 */
export async function GET(request: Request) {
  const auth = await authenticateCronRequest(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const cutoff = url.searchParams.get("cutoff") ?? "2026-09-18";

  try {
    const result = await markHistoricalSnapshotsManual(
      auth.accessToken,
      auth.spreadsheetId,
      cutoff
    );
    return NextResponse.json({ ok: true, cutoff, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
