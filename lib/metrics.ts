import { db } from "./db";
import { posts, snapshots, type Platform, type Snapshot } from "./db/schema";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";

/**
 * Snapshot picked from the timeline closest to a target moment.
 * `delta` tells how far (in ms) the picked snapshot is from the target;
 * UI can flag values where the snapshot is too far away to be trustworthy.
 */
export type PickedSnapshot = {
  snapshot: Snapshot;
  targetAt: Date;
  deltaMs: number;
} | null;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export async function pickClosestSnapshot(
  postId: string,
  targetAt: Date,
  toleranceMs: number,
): Promise<PickedSnapshot> {
  const before = await db
    .select()
    .from(snapshots)
    .where(
      and(
        eq(snapshots.postId, postId),
        lte(snapshots.capturedAt, targetAt),
        gte(
          snapshots.capturedAt,
          new Date(targetAt.getTime() - toleranceMs),
        ),
      ),
    )
    .orderBy(desc(snapshots.capturedAt))
    .limit(1);

  const after = await db
    .select()
    .from(snapshots)
    .where(
      and(
        eq(snapshots.postId, postId),
        gte(snapshots.capturedAt, targetAt),
        lte(
          snapshots.capturedAt,
          new Date(targetAt.getTime() + toleranceMs),
        ),
      ),
    )
    .orderBy(asc(snapshots.capturedAt))
    .limit(1);

  const candidates = [...before, ...after];
  if (candidates.length === 0) return null;

  const best = candidates.reduce((a, b) =>
    Math.abs(a.capturedAt.getTime() - targetAt.getTime()) <
    Math.abs(b.capturedAt.getTime() - targetAt.getTime())
      ? a
      : b,
  );

  return {
    snapshot: best,
    targetAt,
    deltaMs: best.capturedAt.getTime() - targetAt.getTime(),
  };
}

export async function getPostWithCheckpoints(postId: string) {
  const [post] = await db.select().from(posts).where(eq(posts.id, postId));
  if (!post) return null;

  const target24h = new Date(post.publishedAt.getTime() + DAY);
  const target7d = new Date(post.publishedAt.getTime() + 7 * DAY);

  const [latest] = await db
    .select()
    .from(snapshots)
    .where(eq(snapshots.postId, postId))
    .orderBy(desc(snapshots.capturedAt))
    .limit(1);

  // Tolerance: ±2h. With cron at 20:30 PL daily, we typically land within
  // 30–90 min of the target. ±2h covers DST drift and missed cron runs.
  const [at24h, at7d] = await Promise.all([
    pickClosestSnapshot(postId, target24h, 2 * HOUR),
    pickClosestSnapshot(postId, target7d, 2 * HOUR),
  ]);

  return { post, latest: latest ?? null, at24h, at7d };
}

export async function listPostsWithCheckpoints(opts: {
  platform?: Platform;
  limit?: number;
} = {}) {
  const limit = opts.limit ?? 50;
  const where = opts.platform ? eq(posts.platform, opts.platform) : undefined;

  const rows = await db
    .select()
    .from(posts)
    .where(where)
    .orderBy(desc(posts.publishedAt))
    .limit(limit);

  return Promise.all(rows.map((p) => getPostWithCheckpoints(p.id)));
}

/**
 * Decides which posts to snapshot on each daily cron tick.
 *
 * Logic: any post not refreshed in the last 22h. The discovery step sets
 * last_fetched_at on insert, so a post discovered today (at 20:30) is naturally
 * excluded from today's snapshot pass, and included tomorrow at 20:30
 * (~24h later) — that becomes the "Po 24h" checkpoint. Subsequent daily runs
 * keep the time-series alive and produce the "Po 7d" checkpoint at +7d.
 */
export async function getPostsNeedingCapture(): Promise<{ id: string; platform: Platform }[]> {
  const rows = await db.execute(sql`
    SELECT id, platform
    FROM posts
    WHERE last_fetched_at IS NULL
       OR last_fetched_at < now() - interval '22 hours'
    ORDER BY published_at DESC
    LIMIT 200
  `);
  return rows.rows as { id: string; platform: Platform }[];
}
