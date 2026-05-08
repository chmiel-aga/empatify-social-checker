import {
  CollectorNotConfiguredError,
  type Collector,
  type DiscoveredPost,
  type StatsSnapshot,
} from "./types";

/**
 * TikTok Display API — owned account video stats
 * Docs: https://developers.tiktok.com/doc/display-api-overview/
 *
 * Requirements:
 *  - TikTok Developer App with Display API product
 *  - User OAuth flow → `user.info.basic`, `video.list` scopes
 *  - TIKTOK_ACCESS_TOKEN (refreshable), TIKTOK_OPEN_ID
 *
 * Note: per-video stats are limited to view_count, like_count, comment_count,
 * share_count via /video/list/. For watch time and audience retention you need
 * the TikTok for Business / Research API (separate approval).
 */

const API = "https://open.tiktokapis.com/v2";

async function tiktokPost<T>(
  path: string,
  body: Record<string, unknown>,
  fields?: string,
): Promise<T> {
  const token = process.env.TIKTOK_ACCESS_TOKEN!;
  const url = new URL(`${API}/${path}`);
  if (fields) url.searchParams.set("fields", fields);
  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`TikTok ${res.status}: ${txt}`);
  }
  return (await res.json()) as T;
}

type TiktokVideoListResponse = {
  data: {
    videos: {
      id: string;
      title?: string;
      video_description?: string;
      cover_image_url?: string;
      embed_link?: string;
      share_url?: string;
      duration?: number;
      create_time: number;
      view_count?: number;
      like_count?: number;
      comment_count?: number;
      share_count?: number;
    }[];
    cursor?: number;
    has_more?: boolean;
  };
};

const VIDEO_FIELDS =
  "id,title,video_description,cover_image_url,embed_link,share_url,duration,create_time,view_count,like_count,comment_count,share_count";

export const tiktokCollector: Collector = {
  platform: "tiktok",

  isConfigured() {
    return Boolean(process.env.TIKTOK_ACCESS_TOKEN && process.env.TIKTOK_OPEN_ID);
  },

  async listRecentPosts(limit = 20): Promise<DiscoveredPost[]> {
    if (!this.isConfigured()) throw new CollectorNotConfiguredError("tiktok");

    const data = await tiktokPost<TiktokVideoListResponse>(
      "video/list/",
      { max_count: Math.min(limit, 20) },
      VIDEO_FIELDS,
    );

    return (data.data?.videos ?? []).map((v) => ({
      platform: "tiktok" as const,
      externalId: v.id,
      url: v.share_url ?? v.embed_link ?? `https://www.tiktok.com/@_/video/${v.id}`,
      title: v.title ?? null,
      caption: v.video_description ?? null,
      thumbnailUrl: v.cover_image_url ?? null,
      publishedAt: new Date(v.create_time * 1000),
      durationSeconds: v.duration ?? null,
      raw: v,
    }));
  },

  async fetchStats(externalId: string): Promise<StatsSnapshot | null> {
    if (!this.isConfigured()) throw new CollectorNotConfiguredError("tiktok");

    const data = await tiktokPost<TiktokVideoListResponse>(
      "video/query/",
      { filters: { video_ids: [externalId] } },
      VIDEO_FIELDS,
    );

    const v = data.data?.videos?.[0];
    if (!v) return null;

    return {
      views: v.view_count ?? null,
      likes: v.like_count ?? null,
      comments: v.comment_count ?? null,
      shares: v.share_count ?? null,
      raw: v,
    };
  },
};
