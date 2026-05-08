import {
  CollectorNotConfiguredError,
  type Collector,
  type DiscoveredPost,
  type StatsSnapshot,
} from "./types";

/**
 * Instagram Graph API
 * Docs: https://developers.facebook.com/docs/instagram-api/reference/ig-media
 *
 * Requirements:
 *  - Meta Developer App
 *  - Instagram Business or Creator account
 *  - Connected Facebook Page
 *  - Long-lived page access token with: instagram_basic, instagram_manage_insights,
 *    pages_read_engagement, pages_show_list
 *  - INSTAGRAM_BUSINESS_ACCOUNT_ID (the IG-ID linked to the FB Page)
 */

const API = "https://graph.facebook.com/v23.0";

async function fb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN!;
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Instagram Graph ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

type IgMediaListResponse = {
  data: {
    id: string;
    media_type: "IMAGE" | "VIDEO" | "REEL" | "CAROUSEL_ALBUM";
    media_product_type?: "REELS" | "FEED" | "STORY";
    permalink: string;
    caption?: string;
    thumbnail_url?: string;
    media_url?: string;
    timestamp: string;
  }[];
};

type IgInsightsResponse = {
  data: { name: string; values: { value: number }[] }[];
};

export const instagramCollector: Collector = {
  platform: "instagram",

  isConfigured() {
    return Boolean(
      process.env.INSTAGRAM_ACCESS_TOKEN &&
        process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
    );
  },

  async listRecentPosts(limit = 25): Promise<DiscoveredPost[]> {
    if (!this.isConfigured()) throw new CollectorNotConfiguredError("instagram");

    const igId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID!;
    const data = await fb<IgMediaListResponse>(`${igId}/media`, {
      fields:
        "id,media_type,media_product_type,permalink,caption,thumbnail_url,media_url,timestamp",
      limit: String(Math.min(limit, 50)),
    });

    return data.data
      .filter(
        (m) =>
          m.media_product_type === "REELS" ||
          m.media_type === "VIDEO" ||
          m.media_type === "REEL",
      )
      .map((m) => ({
        platform: "instagram" as const,
        externalId: m.id,
        url: m.permalink,
        title: null,
        caption: m.caption ?? null,
        thumbnailUrl: m.thumbnail_url ?? m.media_url ?? null,
        publishedAt: new Date(m.timestamp),
        raw: m,
      }));
  },

  async fetchStats(externalId: string): Promise<StatsSnapshot | null> {
    if (!this.isConfigured()) throw new CollectorNotConfiguredError("instagram");

    // Insights metrics vary by media type and were renamed in 2024 (plays → views).
    // Strategy: ask for the modern set; if any single metric is rejected, fall back
    // to the safe subset. Likes/comments come from the media object itself.
    const tryFetch = async (metricList: string[]) =>
      fb<IgInsightsResponse>(`${externalId}/insights`, {
        metric: metricList.join(","),
      });

    let insights: IgInsightsResponse | null = null;
    try {
      insights = await tryFetch([
        "views",
        "reach",
        "likes",
        "comments",
        "shares",
        "saved",
        "total_interactions",
      ]);
    } catch {
      // Older / different media type — try minimal safe set
      try {
        insights = await tryFetch(["reach", "saved", "shares"]);
      } catch {
        insights = { data: [] };
      }
    }

    // Likes / comments authoritative source: media object itself
    const media: { like_count?: number; comments_count?: number } = await fb<{
      like_count?: number;
      comments_count?: number;
    }>(externalId, { fields: "like_count,comments_count" }).catch(() => ({}) as { like_count?: number; comments_count?: number });

    const get = (name: string) =>
      insights?.data.find((d) => d.name === name)?.values[0]?.value ?? null;

    return {
      views: get("views") ?? get("reach"),
      likes: media.like_count ?? get("likes") ?? null,
      comments: media.comments_count ?? get("comments") ?? null,
      shares: get("shares"),
      saves: get("saved"),
      reach: get("reach"),
      raw: { insights, media },
    };
  },
};
