import { NextResponse } from "next/server";
import { getPostsNeedingCapture } from "@/lib/metrics";
import { refreshPostStats } from "@/lib/ingest";
import { requireCronAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Captures fresh snapshots for posts that:
 *  - are approaching their 24h or 7d checkpoint (priority window), OR
 *  - have not been refreshed in the last 6 hours (regular cadence)
 *
 * Run hourly via vercel.json.
 */
export async function GET(request: Request) {
  const fail = requireCronAuth(request);
  if (fail) return fail;

  const candidates = await getPostsNeedingCapture();
  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const c of candidates) {
    try {
      await refreshPostStats(c.id);
      results.push({ id: c.id, ok: true });
    } catch (err) {
      results.push({ id: c.id, ok: false, error: (err as Error).message });
    }
  }

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    processed: results.length,
    results,
  });
}
