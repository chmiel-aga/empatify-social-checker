import { db } from "./db";
import { posts, snapshots, type Platform, type Post, type Snapshot } from "./db/schema";
import { and, asc, desc, eq, gte, lte, inArray, sql } from "drizzle-orm";
import { polishDay } from "./content-key";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const CHECKPOINT_TOLERANCE = 2 * HOUR;

export type PlatformStats = {
  platform: Platform;
  post: Post;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  views24h: number | null;
  views7d: number | null;
  capturedAt: Date | null;
};

/**
 * One logical reel — multiple platform versions aggregated by smart-day matching.
 */
export type ContentGroup = {
  contentKey: string;
  /** Primary display title — preference: YouTube title > any title > first caption line. */
  title: string;
  /** Additional unique titles/captions when platforms used different copy. */
  subtitles: { platform: Platform; text: string }[];
  thumbnailUrl: string | null;
  /** Earliest publish across platforms (since they may publish minutes apart). */
  publishedAt: Date;
  platforms: PlatformStats[];
  /** Sums across platforms — null if all are null. */
  totalViews: number | null;
  totalLikes: number | null;
  totalComments: number | null;
  total24h: number | null;
  total7d: number | null;
};

/**
 * Batch-load latest snapshot per post — single query for many post IDs.
 * Replaces N round-trips with 1.
 */
async function getLatestSnapshotsByPost(
  postIds: string[],
): Promise<Map<string, Snapshot>> {
  if (postIds.length === 0) return new Map();
  const rows = await db
    .selectDistinctOn([snapshots.postId])
    .from(snapshots)
    .where(inArray(snapshots.postId, postIds))
    .orderBy(snapshots.postId, desc(snapshots.capturedAt));
  const out = new Map<string, Snapshot>();
  for (const r of rows) out.set(r.postId, r);
  return out;
}

/**
 * Batch-load checkpoint views per post (24h or 7d offset).
 * Picks the snapshot closest to publishedAt + offset, within ±2h tolerance.
 */
async function getCheckpointsByPost(
  posts: { id: string; publishedAt: Date }[],
  hoursOffset: number,
): Promise<Map<string, number>> {
  if (posts.length === 0) return new Map();
  const ids = posts.map((p) => p.id);

  // Pull all snapshots in the union of relevant time windows, then bucket per post.
  // We over-fetch a bit; in JS we pick the closest per post.
  const allSnapshots = await db
    .select({
      postId: snapshots.postId,
      capturedAt: snapshots.capturedAt,
      views: snapshots.views,
    })
    .from(snapshots)
    .where(
      and(
        inArray(snapshots.postId, ids),
        sql`${snapshots.views} IS NOT NULL`,
      ),
    );

  const byPost = new Map<string, { capturedAt: Date; views: number | null }[]>();
  for (const s of allSnapshots) {
    const list = byPost.get(s.postId) ?? [];
    list.push({ capturedAt: s.capturedAt, views: s.views });
    byPost.set(s.postId, list);
  }

  const result = new Map<string, number>();
  for (const p of posts) {
    const target = p.publishedAt.getTime() + hoursOffset * HOUR;
    const lower = target - CHECKPOINT_TOLERANCE;
    const upper = target + CHECKPOINT_TOLERANCE;
    const candidates = byPost.get(p.id) ?? [];
    let best: { capturedAt: number; views: number } | null = null;
    for (const c of candidates) {
      const t = c.capturedAt.getTime();
      if (t < lower || t > upper) continue;
      if (c.views == null) continue;
      const dist = Math.abs(t - target);
      if (!best || dist < Math.abs(best.capturedAt - target)) {
        best = { capturedAt: t, views: c.views };
      }
    }
    if (best) result.set(p.id, best.views);
  }
  return result;
}

function sumOrNull(values: (number | null)[]): number | null {
  const filtered = values.filter((v): v is number => v != null);
  return filtered.length > 0 ? filtered.reduce((a, b) => a + b, 0) : null;
}

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleFp(text: string): string {
  return normalizeText(text).split(" ").slice(0, 6).join(" ").slice(0, 80);
}

function extractDisplayText(p: Post): string {
  if (p.title?.trim()) return p.title.trim();
  if (p.caption?.trim()) {
    return p.caption.split("\n")[0].slice(0, 100).trim();
  }
  return "";
}

/**
 * Smart-grouping: group posts by Polish-day. Within each day:
 *  - If every platform has at most 1 post → merge all (one logical reel that day)
 *  - Otherwise → split by title fingerprint (multiple distinct reels that day)
 */
function smartGroup(allPosts: Post[]): { key: string; posts: Post[] }[] {
  const byDay = new Map<string, Post[]>();
  for (const p of allPosts) {
    const day = polishDay(p.publishedAt);
    const list = byDay.get(day) ?? [];
    list.push(p);
    byDay.set(day, list);
  }

  const out: { key: string; posts: Post[] }[] = [];
  for (const [day, dayPosts] of byDay) {
    const platformCounts = new Map<Platform, number>();
    for (const p of dayPosts) {
      platformCounts.set(p.platform, (platformCounts.get(p.platform) ?? 0) + 1);
    }
    const hasMultiple = Array.from(platformCounts.values()).some((c) => c > 1);

    if (!hasMultiple) {
      out.push({ key: `${day}`, posts: dayPosts });
    } else {
      const byFp = new Map<string, Post[]>();
      for (const p of dayPosts) {
        const fp = titleFp(extractDisplayText(p)) || `solo-${p.id}`;
        const list = byFp.get(fp) ?? [];
        list.push(p);
        byFp.set(fp, list);
      }
      for (const [fp, list] of byFp) {
        out.push({ key: `${day}__${fp}`, posts: list });
      }
    }
  }
  return mergeCrossDayOrphans(out);
}

const META_PLATFORMS: Platform[] = ["instagram", "facebook"];
const CROSS_DAY_WINDOW_DAYS = 2;

/**
 * Second-pass merge: same logical reel can be cross-posted on different days
 * (Empatify often posts to YT one day and to IG/FB next day with a different
 * caption). We match YT-orphans (groups containing only YouTube posts) with
 * Meta-orphans (only IG/FB) within ±2 days, when there's exactly one such
 * candidate on each side. This keeps the "one reel = one row" invariant.
 *
 * Conservative rules:
 *  - Both groups must have NO platform overlap.
 *  - Match YT-only ↔ IG/FB-only (don't merge YT with TT, etc.).
 *  - If a YT-orphan has multiple Meta-orphan candidates within window, skip
 *    (ambiguous — better to leave separate than mismerge).
 */
function mergeCrossDayOrphans(
  groups: { key: string; posts: Post[] }[],
): { key: string; posts: Post[] }[] {
  const isYtOnly = (g: { posts: Post[] }) =>
    g.posts.every((p) => p.platform === "youtube");
  const isMetaOnly = (g: { posts: Post[] }) =>
    g.posts.length > 0 &&
    g.posts.every((p) => META_PLATFORMS.includes(p.platform));

  const earliestPublish = (g: { posts: Post[] }) =>
    g.posts.reduce(
      (min, p) => (p.publishedAt < min ? p.publishedAt : min),
      g.posts[0].publishedAt,
    );

  const consumed = new Set<number>();
  const ytIdx: number[] = [];
  const metaIdx: number[] = [];
  groups.forEach((g, i) => {
    if (isYtOnly(g)) ytIdx.push(i);
    else if (isMetaOnly(g)) metaIdx.push(i);
  });

  // Build all (yt, meta) candidate pairs within window with date distance.
  type Pair = { yi: number; mi: number; dist: number };
  const pairs: Pair[] = [];
  for (const yi of ytIdx) {
    const ytDate = earliestPublish(groups[yi]).getTime();
    for (const mi of metaIdx) {
      const mDate = earliestPublish(groups[mi]).getTime();
      const dist = Math.abs(ytDate - mDate) / (24 * 3600 * 1000);
      if (dist <= CROSS_DAY_WINDOW_DAYS) pairs.push({ yi, mi, dist });
    }
  }
  // Greedy: process closest pairs first; consume both sides on match.
  pairs.sort((a, b) => a.dist - b.dist);

  const result: { key: string; posts: Post[] }[] = [];
  for (const { yi, mi } of pairs) {
    if (consumed.has(yi) || consumed.has(mi)) continue;
    const merged = [...groups[yi].posts, ...groups[mi].posts];
    const earliestKey = polishDay(
      merged.reduce(
        (min, p) => (p.publishedAt < min ? p.publishedAt : min),
        merged[0].publishedAt,
      ),
    );
    result.push({ key: `${earliestKey}__merged-cross`, posts: merged });
    consumed.add(yi);
    consumed.add(mi);
  }

  // Untouched groups stay as-is
  groups.forEach((g, i) => {
    if (!consumed.has(i)) result.push(g);
  });
  return result;
}

export async function listContentGroups(opts: {
  platform?: Platform;
  limit?: number;
} = {}): Promise<ContentGroup[]> {
  const limit = opts.limit ?? 100;

  // Smart matching needs cross-platform context, so when a platform filter is
  // set we still fetch ALL posts to compute groups, then filter to groups
  // that include the requested platform.
  const rows = await db
    .select()
    .from(posts)
    .orderBy(desc(posts.publishedAt))
    .limit(800);

  const grouped = smartGroup(rows);

  // Batch-fetch all snapshot data we need for ALL posts in one go.
  const allPostIds = rows.map((r) => r.id);
  const [latestByPost, views24hByPost, views7dByPost] = await Promise.all([
    getLatestSnapshotsByPost(allPostIds),
    getCheckpointsByPost(rows, 24),
    getCheckpointsByPost(rows, 24 * 7),
  ]);

  const built: ContentGroup[] = [];
  for (const { key, posts: postsInGroup } of grouped) {
    if (opts.platform && !postsInGroup.some((p) => p.platform === opts.platform)) {
      continue;
    }

    const enriched: PlatformStats[] = postsInGroup.map((p) => {
      const snap = latestByPost.get(p.id);
      return {
        platform: p.platform,
        post: p,
        views: snap?.views ?? null,
        likes: snap?.likes ?? null,
        comments: snap?.comments ?? null,
        shares: snap?.shares ?? null,
        views24h: views24hByPost.get(p.id) ?? null,
        views7d: views7dByPost.get(p.id) ?? null,
        capturedAt: snap?.capturedAt ?? null,
      };
    });

    // Primary title — prefer YouTube title (usually most descriptive).
    const ytPost = postsInGroup.find(
      (p) => p.platform === "youtube" && p.title?.trim(),
    );
    const fallbackTitled = postsInGroup.find((p) => p.title?.trim());
    const fallbackCaptioned = postsInGroup.find((p) => p.caption?.trim());
    const primaryText =
      ytPost?.title?.trim() ||
      fallbackTitled?.title?.trim() ||
      (fallbackCaptioned?.caption
        ? fallbackCaptioned.caption.split("\n")[0].slice(0, 100).trim()
        : "(bez tytułu)");

    // Subtitles: unique titles/captions from OTHER platforms that differ enough.
    const seenFps = new Set<string>([titleFp(primaryText)]);
    const subtitles: { platform: Platform; text: string }[] = [];
    for (const p of postsInGroup) {
      const text = extractDisplayText(p);
      if (!text) continue;
      const fp = titleFp(text);
      if (seenFps.has(fp)) continue;
      seenFps.add(fp);
      subtitles.push({ platform: p.platform, text });
      if (subtitles.length >= 3) break;
    }

    const thumbnail =
      postsInGroup.find((p) => p.thumbnailUrl)?.thumbnailUrl ?? null;
    const earliest = postsInGroup.reduce((a, b) =>
      a.publishedAt < b.publishedAt ? a : b,
    );

    built.push({
      contentKey: key,
      title: primaryText,
      subtitles,
      thumbnailUrl: thumbnail,
      publishedAt: earliest.publishedAt,
      platforms: enriched,
      totalViews: sumOrNull(enriched.map((e) => e.views)),
      totalLikes: sumOrNull(enriched.map((e) => e.likes)),
      totalComments: sumOrNull(enriched.map((e) => e.comments)),
      total24h: sumOrNull(enriched.map((e) => e.views24h)),
      total7d: sumOrNull(enriched.map((e) => e.views7d)),
    });
  }

  built.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  return built.slice(0, limit);
}

export async function getContentGroup(
  contentKey: string,
): Promise<ContentGroup | null> {
  const all = await listContentGroups({ limit: 1000 });
  return all.find((g) => g.contentKey === contentKey) ?? null;
}

/**
 * Compute KPI summary across groups + viral threshold.
 *
 * Viral = totalViews >= 2× median across groups with at least one snapshot.
 * Adaptive: as Empatify grows, the viral bar moves up.
 */
export type Summary = {
  groupCount: number;
  platformSpread: Record<Platform, number>;
  /** Platforms that have any data in the result set (configured OR mock). */
  platformsWithData: Platform[];
  median24h: number | null;
  median7d: number | null;
  viralThreshold: number | null;
  totalLifetimeViews: number;
};

export function summarize(groups: ContentGroup[]): Summary {
  const platformSpread: Record<Platform, number> = {
    youtube: 0,
    tiktok: 0,
    facebook: 0,
    instagram: 0,
  };
  for (const g of groups) {
    for (const p of g.platforms) platformSpread[p.platform]++;
  }

  const median = (arr: number[]) => {
    if (arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  };

  const v24 = groups.map((g) => g.total24h).filter((n): n is number => n != null);
  const v7 = groups.map((g) => g.total7d).filter((n): n is number => n != null);
  const allViews = groups
    .map((g) => g.totalViews)
    .filter((n): n is number => n != null);

  const medianViews = median(allViews);

  const platformsWithData = (Object.keys(platformSpread) as Platform[]).filter(
    (p) => platformSpread[p] > 0,
  );

  return {
    groupCount: groups.length,
    platformSpread,
    platformsWithData,
    median24h: median(v24),
    median7d: median(v7),
    viralThreshold: medianViews ? medianViews * 2 : null,
    totalLifetimeViews: allViews.reduce((a, b) => a + b, 0),
  };
}

export function isViral(group: ContentGroup, threshold: number | null): boolean {
  if (!threshold || group.totalViews == null) return false;
  return group.totalViews >= threshold;
}
