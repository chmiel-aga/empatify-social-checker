import { NextResponse } from "next/server";
import { configuredPlatforms } from "@/lib/collectors";
import { syncPlatform, refreshPostStats } from "@/lib/ingest";
import { getPostsNeedingCapture } from "@/lib/metrics";
import { requireCronAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily run (20:30 PL). Two phases:
 *
 *  1. DISCOVER — find newly published reels per platform. captureInitial=false:
 *     today's just-posted reels go into the DB without a t≈0 snapshot. Their
 *     first snapshot is captured tomorrow (~24h later).
 *
 *  2. SNAPSHOT — refresh stats for every post not refreshed in the last 22h.
 *     For yesterday's reel this is the 24h checkpoint; for week-old reels the
 *     7d checkpoint; for older reels just an ongoing data point.
 */
export async function GET(request: Request) {
  const fail = requireCronAuth(request);
  if (fail) return fail;

  // 1. Discover
  const platforms = configuredPlatforms();
  const discovery: Record<string, unknown> = {};
  for (const platform of platforms) {
    try {
      discovery[platform] = await syncPlatform(platform, { captureInitial: false });
    } catch (err) {
      console.error(`[cron/daily/discover] ${platform}:`, err);
      discovery[platform] = { error: (err as Error).message };
    }
  }

  // 2. Snapshot
  const candidates = await getPostsNeedingCapture();
  const snapshot: { id: string; ok: boolean; error?: string }[] = [];
  for (const c of candidates) {
    try {
      await refreshPostStats(c.id);
      snapshot.push({ id: c.id, ok: true });
    } catch (err) {
      snapshot.push({ id: c.id, ok: false, error: (err as Error).message });
    }
  }

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    discovery,
    snapshot: { processed: snapshot.length, failed: snapshot.filter((s) => !s.ok).length },
  });
}
