import {
  pgTable,
  text,
  timestamp,
  bigint,
  uuid,
  uniqueIndex,
  index,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";

export const platformEnum = pgEnum("platform", [
  "youtube",
  "tiktok",
  "facebook",
  "instagram",
]);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    platform: platformEnum("platform").notNull(),
    externalId: text("external_id").notNull(),
    url: text("url").notNull(),
    title: text("title"),
    caption: text("caption"),
    thumbnailUrl: text("thumbnail_url"),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    durationSeconds: bigint("duration_seconds", { mode: "number" }),
    isReel: text("is_reel").default("true"),
    /**
     * Cross-platform aggregation key. Posts on different platforms that share
     * the same content_key are treated as the same logical reel in the UI.
     * Format: `YYYY-MM-DD__<normalized title fingerprint>` (Polish day).
     */
    contentKey: text("content_key"),
    raw: jsonb("raw"),
    discoveredAt: timestamp("discovered_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
  },
  (t) => ({
    uniqPlatformExternal: uniqueIndex("uniq_platform_external").on(
      t.platform,
      t.externalId,
    ),
    publishedIdx: index("posts_published_idx").on(t.publishedAt),
    contentKeyIdx: index("posts_content_key_idx").on(t.contentKey),
  }),
);

export const snapshots = pgTable(
  "snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    views: bigint("views", { mode: "number" }),
    likes: bigint("likes", { mode: "number" }),
    comments: bigint("comments", { mode: "number" }),
    shares: bigint("shares", { mode: "number" }),
    saves: bigint("saves", { mode: "number" }),
    reach: bigint("reach", { mode: "number" }),
    impressions: bigint("impressions", { mode: "number" }),
    watchTimeSeconds: bigint("watch_time_seconds", { mode: "number" }),
    avgViewDurationSeconds: bigint("avg_view_duration_seconds", {
      mode: "number",
    }),
    raw: jsonb("raw"),
  },
  (t) => ({
    postCapturedIdx: index("snapshots_post_captured_idx").on(
      t.postId,
      t.capturedAt,
    ),
  }),
);

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Snapshot = typeof snapshots.$inferSelect;
export type NewSnapshot = typeof snapshots.$inferInsert;
export type Platform = (typeof platformEnum.enumValues)[number];
