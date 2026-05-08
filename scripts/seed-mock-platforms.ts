import "dotenv/config";
import { config } from "dotenv";
import { Pool } from "@neondatabase/serverless";

config({ path: ".env.local" });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Seeds plausible Instagram / TikTok / Facebook posts mirroring existing
 * YouTube posts. Marks them with raw->>'_mock' = 'true' so they can be cleaned
 * up via `scripts/clear-mock-platforms.ts`.
 *
 * Stats are randomized per platform with realistic distribution patterns
 * (TikTok: high views, IG: high engagement, FB: weakest reach for a niche).
 */

type Platform = "instagram" | "tiktok" | "facebook";

const PLATFORMS: Platform[] = ["instagram", "tiktok", "facebook"];

// Platform-typical multipliers vs YouTube views, applied with jitter.
const PROFILE: Record<
  Platform,
  {
    viewsMul: [number, number]; // [min, max]
    likesRate: [number, number]; // pct of views
    commentsRate: [number, number];
    sharesRate: [number, number];
    savesRate: [number, number];
    urlPrefix: (id: string) => string;
  }
> = {
  tiktok: {
    viewsMul: [1.5, 4.5],
    likesRate: [0.03, 0.08],
    commentsRate: [0.001, 0.005],
    sharesRate: [0.005, 0.025],
    savesRate: [0.01, 0.03],
    urlPrefix: (id) => `https://www.tiktok.com/@empatify/video/${id}`,
  },
  instagram: {
    viewsMul: [0.6, 1.4],
    likesRate: [0.05, 0.12],
    commentsRate: [0.002, 0.008],
    sharesRate: [0.003, 0.012],
    savesRate: [0.015, 0.04],
    urlPrefix: (id) => `https://www.instagram.com/reel/${id}/`,
  },
  facebook: {
    viewsMul: [0.2, 0.7],
    likesRate: [0.01, 0.04],
    commentsRate: [0.001, 0.004],
    sharesRate: [0.005, 0.02],
    savesRate: [0, 0],
    urlPrefix: (id) => `https://www.facebook.com/empatify/videos/${id}`,
  },
};

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
}

(async () => {
  // 1. Pull existing YouTube posts + their latest snapshot views.
  const { rows: ytPosts } = await pool.query(`
    SELECT
      p.id, p.title, p.caption, p.thumbnail_url, p.published_at,
      p.duration_seconds, p.content_key, p.url AS yt_url,
      s.views AS yt_views,
      s.likes AS yt_likes,
      s.comments AS yt_comments
    FROM posts p
    LEFT JOIN LATERAL (
      SELECT * FROM snapshots WHERE post_id = p.id
      ORDER BY captured_at DESC LIMIT 1
    ) s ON TRUE
    WHERE p.platform = 'youtube'
    ORDER BY p.published_at DESC
  `);

  console.log(`Seeding mock IG/TT/FB clones for ${ytPosts.length} YouTube posts...`);
  let inserted = 0;
  let snapshotsAdded = 0;

  for (const yt of ytPosts) {
    const ytViews = Number(yt.yt_views ?? 0);

    for (const platform of PLATFORMS) {
      const profile = PROFILE[platform];
      const externalId = randId(platform.slice(0, 2));
      const url = profile.urlPrefix(externalId);
      // Posted within ±90 min of YouTube post (cross-platform staggered)
      const publishOffsetMs = (rand(-90, 90) | 0) * 60 * 1000;
      const publishedAt = new Date(
        new Date(yt.published_at).getTime() + publishOffsetMs,
      );

      // Insert post
      const ins = await pool.query(
        `INSERT INTO posts
         (platform, external_id, url, title, caption, thumbnail_url,
          published_at, duration_seconds, content_key, raw, last_fetched_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
         ON CONFLICT (platform, external_id) DO NOTHING
         RETURNING id`,
        [
          platform,
          externalId,
          url,
          yt.title,
          yt.caption,
          yt.thumbnail_url,
          publishedAt,
          yt.duration_seconds,
          yt.content_key,
          { _mock: true, source: "yt-clone", ytPostId: yt.id },
        ],
      );
      if (ins.rows.length === 0) continue;
      const newPostId = ins.rows[0].id;
      inserted++;

      // Generate snapshot stats
      const views = Math.max(1, Math.round(ytViews * rand(...profile.viewsMul)));
      const likes = Math.round(views * rand(...profile.likesRate));
      const comments = Math.round(views * rand(...profile.commentsRate));
      const shares = Math.round(views * rand(...profile.sharesRate));
      const saves = profile.savesRate[1] > 0
        ? Math.round(views * rand(...profile.savesRate))
        : null;

      await pool.query(
        `INSERT INTO snapshots
         (post_id, views, likes, comments, shares, saves, raw)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          newPostId,
          views,
          likes,
          comments,
          shares,
          saves,
          { _mock: true },
        ],
      );
      snapshotsAdded++;

      // Daily snapshots from 24h after publish until "now" — shows growth curve.
      // Typical reel: 50% by 24h, 75% by 48h, 90% by 72h, 95% by 7d, plateau after.
      const ageHours = (Date.now() - publishedAt.getTime()) / 3600 / 1000;
      const ageDays = Math.floor(ageHours / 24);
      const fraction = (h: number) => {
        // Asymptotic curve toward 1.0, jittered
        const base = 1 - Math.exp(-h / 36); // half-life ~25h
        return Math.min(0.99, base * rand(0.92, 1.05));
      };
      for (let day = 1; day <= Math.min(ageDays, 14); day++) {
        const at = new Date(publishedAt.getTime() + day * 24 * 3600 * 1000);
        const f = fraction(day * 24);
        const v = Math.max(1, Math.round(views * f));
        const checkpoint = day === 1 ? "24h" : day === 7 ? "7d" : null;
        await pool.query(
          `INSERT INTO snapshots
           (post_id, views, likes, comments, shares, saves, captured_at, raw)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            newPostId,
            v,
            Math.round(v * rand(...profile.likesRate)),
            Math.round(v * rand(...profile.commentsRate)),
            Math.round(v * rand(...profile.sharesRate)),
            profile.savesRate[1] > 0
              ? Math.round(v * rand(...profile.savesRate))
              : null,
            at,
            { _mock: true, ...(checkpoint ? { checkpoint } : {}) },
          ],
        );
        snapshotsAdded++;
      }
    }
  }

  // Also backfill daily snapshots for YouTube posts (same growth curve).
  console.log("\nBackfilling YouTube daily snapshots...");
  for (const yt of ytPosts) {
    const ytViews = Number(yt.yt_views ?? 0);
    if (ytViews === 0) continue;
    const publishedAt = new Date(yt.published_at);
    const ageHours = (Date.now() - publishedAt.getTime()) / 3600 / 1000;
    const ageDays = Math.floor(ageHours / 24);
    for (let day = 1; day <= Math.min(ageDays, 14); day++) {
      const at = new Date(publishedAt.getTime() + day * 24 * 3600 * 1000);
      const f = Math.min(0.99, (1 - Math.exp(-day * 24 / 36)) * rand(0.92, 1.05));
      const v = Math.max(1, Math.round(ytViews * f));
      const checkpoint = day === 1 ? "24h" : day === 7 ? "7d" : null;
      await pool.query(
        `INSERT INTO snapshots
         (post_id, views, likes, comments, captured_at, raw)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          yt.id,
          v,
          Math.round(v * 0.012),
          Math.round(v * 0.002),
          at,
          { _mock: true, ...(checkpoint ? { checkpoint } : {}) },
        ],
      );
      snapshotsAdded++;
    }
  }

  console.log(`\n✓ ${inserted} mock posts inserted`);
  console.log(`✓ ${snapshotsAdded} mock snapshots inserted`);
  console.log("\nRun `npx tsx scripts/clear-mock-platforms.ts` to remove all mocks.");
  await pool.end();
})();
