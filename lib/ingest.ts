import { db } from "./db";
import { posts, snapshots, type Platform } from "./db/schema";
import { collectors } from "./collectors";
import { computeContentKey } from "./content-key";
import { eq, and } from "drizzle-orm";

/**
 * Discover new posts from a platform and (optionally) capture an initial snapshot.
 *
 * captureInitial: false → discover only, no stats fetch. Used by the daily cron
 *   so today's just-posted reels don't pollute the time-series with a t≈0 point.
 *   Tomorrow's run captures their first snapshot at the 24h mark.
 *
 * Returns counts: discovered (new), updated (already known), captured.
 */
export async function syncPlatform(
  platform: Platform,
  opts: { limit?: number; captureInitial?: boolean } = {},
) {
  const limit = opts.limit ?? 25;
  const captureInitial = opts.captureInitial ?? true;
  const collector = collectors[platform];
  if (!collector.isConfigured()) {
    return { discovered: 0, updated: 0, captured: 0, skipped: true };
  }

  const recent = await collector.listRecentPosts(limit);
  let discovered = 0;
  let updated = 0;
  let captured = 0;

  for (const p of recent) {
    const [existing] = await db
      .select()
      .from(posts)
      .where(
        and(eq(posts.platform, platform), eq(posts.externalId, p.externalId)),
      );

    const contentKey = computeContentKey(p.title, p.publishedAt);

    let postId: string;
    if (existing) {
      postId = existing.id;
      // IMPORTANT: do NOT update lastFetchedAt here. That field tracks
      // "last time a snapshot was captured" and is used by getPostsNeedingCapture.
      // If discovery refreshed it, the snapshot phase would skip every post
      // returned by listRecentPosts (the most recent 25), defeating the cron.
      await db
        .update(posts)
        .set({
          title: p.title ?? existing.title,
          caption: p.caption ?? existing.caption,
          thumbnailUrl: p.thumbnailUrl ?? existing.thumbnailUrl,
          durationSeconds: p.durationSeconds ?? existing.durationSeconds,
          contentKey: existing.contentKey ?? contentKey,
          raw: p.raw ?? existing.raw,
        })
        .where(eq(posts.id, postId));
      updated++;
    } else {
      // New post: lastFetchedAt stays null. getPostsNeedingCapture treats null
      // as "needs capture", so the snapshot phase will pick it up immediately
      // (or, if captureInitial=true, the loop below sets it explicitly).
      const [inserted] = await db
        .insert(posts)
        .values({
          platform: p.platform,
          externalId: p.externalId,
          url: p.url,
          title: p.title,
          caption: p.caption,
          thumbnailUrl: p.thumbnailUrl,
          publishedAt: p.publishedAt,
          durationSeconds: p.durationSeconds ?? null,
          contentKey,
          raw: p.raw,
        })
        .returning({ id: posts.id });
      postId = inserted.id;
      discovered++;
    }

    if (captureInitial) {
      try {
        const stats = await collector.fetchStats(p.externalId);
        if (stats) {
          await db.insert(snapshots).values({ postId, ...stats });
          captured++;
        }
      } catch (err) {
        console.error(`[ingest] stats fail ${platform}/${p.externalId}:`, err);
      }
    }
  }

  return { discovered, updated, captured, skipped: false };
}

/**
 * Refresh stats for a known post (does not discover new posts).
 */
export async function refreshPostStats(postId: string) {
  const [post] = await db.select().from(posts).where(eq(posts.id, postId));
  if (!post) return null;

  const collector = collectors[post.platform];
  if (!collector.isConfigured()) return null;

  const stats = await collector.fetchStats(post.externalId);
  if (!stats) return null;

  await db.insert(snapshots).values({ postId: post.id, ...stats });
  await db
    .update(posts)
    .set({ lastFetchedAt: new Date() })
    .where(eq(posts.id, post.id));

  return stats;
}
