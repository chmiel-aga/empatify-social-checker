import {
  CollectorNotConfiguredError,
  type Collector,
  type DiscoveredPost,
  type StatsSnapshot,
} from "./types";

/**
 * Facebook Graph API — Page videos / Reels
 * Docs: https://developers.facebook.com/docs/graph-api/reference/page/videos
 *
 * Requirements:
 *  - Facebook Page admin access
 *  - Page access token with: pages_read_engagement, pages_show_list, read_insights
 *  - FACEBOOK_PAGE_ID
 */

const API = "https://graph.facebook.com/v23.0";

async function fb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = process.env.FACEBOOK_ACCESS_TOKEN!;
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Facebook Graph ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

type FbVideoListResponse = {
  data: {
    id: string;
    permalink_url?: string;
    description?: string;
    title?: string;
    picture?: string;
    created_time: string;
    length?: number;
  }[];
};

type FbVideoStatsResponse = {
  views?: number;
  likes?: { summary: { total_count: number } };
  comments?: { summary: { total_count: number } };
  shares?: { count: number };
};

type FbInsightsResponse = {
  data: { name: string; values: { value: number }[] }[];
};

export const facebookCollector: Collector = {
  platform: "facebook",

  isConfigured() {
    return Boolean(
      process.env.FACEBOOK_ACCESS_TOKEN && process.env.FACEBOOK_PAGE_ID,
    );
  },

  async listRecentPosts(limit = 25): Promise<DiscoveredPost[]> {
    if (!this.isConfigured()) throw new CollectorNotConfiguredError("facebook");

    const pageId = process.env.FACEBOOK_PAGE_ID!;
    const data = await fb<FbVideoListResponse>(`${pageId}/video_reels`, {
      fields: "id,permalink_url,description,title,picture,created_time,length",
      limit: String(Math.min(limit, 50)),
    }).catch(async () => {
      // Fallback to /videos if /video_reels not available for the page
      return fb<FbVideoListResponse>(`${pageId}/videos`, {
        fields: "id,permalink_url,description,title,picture,created_time,length",
        limit: String(Math.min(limit, 50)),
      });
    });

    return data.data.map((v) => ({
      platform: "facebook" as const,
      externalId: v.id,
      url: v.permalink_url ?? `https://www.facebook.com/${v.id}`,
      title: v.title ?? null,
      caption: v.description ?? null,
      thumbnailUrl: v.picture ?? null,
      publishedAt: new Date(v.created_time),
      durationSeconds: v.length ? Math.round(v.length) : null,
      raw: v,
    }));
  },

  async fetchStats(externalId: string): Promise<StatsSnapshot | null> {
    if (!this.isConfigured()) throw new CollectorNotConfiguredError("facebook");

    // For Page Reels, /video_insights returns empty data even though the
    // `total_video_views` metric is "valid". Reels expose their view counter
    // via the `views` field directly on the object — so we use that.
    // Still try video_insights as a fallback for legacy regular videos.
    const [base, insights] = await Promise.all([
      fb<FbVideoStatsResponse>(externalId, {
        fields:
          "views,likes.summary(true).limit(0),comments.summary(true).limit(0)",
      }).catch(() => ({}) as FbVideoStatsResponse),
      fb<FbInsightsResponse>(`${externalId}/video_insights`, {
        metric:
          "total_video_views,total_video_impressions,total_video_avg_time_watched",
      }).catch(() => ({ data: [] }) as FbInsightsResponse),
    ]);

    const insight = (n: string) =>
      insights.data.find((d) => d.name === n)?.values[0]?.value ?? null;

    return {
      views: base.views ?? insight("total_video_views"),
      likes: base.likes?.summary.total_count ?? null,
      comments: base.comments?.summary.total_count ?? null,
      shares: null,
      impressions: insight("total_video_impressions"),
      avgViewDurationSeconds: insight("total_video_avg_time_watched"),
      raw: { base, insights },
    };
  },
};
