import {
  CollectorNotConfiguredError,
  type Collector,
  type DiscoveredPost,
  type StatsSnapshot,
} from "./types";

const API = "https://www.googleapis.com/youtube/v3";

function parseISO8601Duration(d: string): number | null {
  const m = d.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  const [, h, mm, s] = m;
  return Number(h ?? 0) * 3600 + Number(mm ?? 0) * 60 + Number(s ?? 0);
}

async function gFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = process.env.YOUTUBE_API_KEY!;
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", key);
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

type SearchListResponse = {
  items: { id: { videoId: string }; snippet: { publishedAt: string } }[];
  nextPageToken?: string;
};

type VideoListResponse = {
  items: {
    id: string;
    snippet: {
      publishedAt: string;
      title: string;
      description: string;
      thumbnails: { high?: { url: string }; default?: { url: string } };
    };
    contentDetails: { duration: string };
    statistics: {
      viewCount?: string;
      likeCount?: string;
      commentCount?: string;
      favoriteCount?: string;
    };
  }[];
};

export const youtubeCollector: Collector = {
  platform: "youtube",

  isConfigured() {
    return Boolean(process.env.YOUTUBE_API_KEY && process.env.YOUTUBE_CHANNEL_ID);
  },

  async listRecentPosts(limit = 25): Promise<DiscoveredPost[]> {
    if (!this.isConfigured()) throw new CollectorNotConfiguredError("youtube");

    const search = await gFetch<SearchListResponse>("search", {
      part: "id",
      channelId: process.env.YOUTUBE_CHANNEL_ID!,
      order: "date",
      maxResults: String(Math.min(limit, 50)),
      type: "video",
    });

    const ids = search.items.map((i) => i.id.videoId).filter(Boolean);
    if (ids.length === 0) return [];

    const videos = await gFetch<VideoListResponse>("videos", {
      part: "snippet,contentDetails,statistics",
      id: ids.join(","),
    });

    return videos.items.map((v) => ({
      platform: "youtube" as const,
      externalId: v.id,
      url: `https://www.youtube.com/watch?v=${v.id}`,
      title: v.snippet.title,
      caption: v.snippet.description,
      thumbnailUrl:
        v.snippet.thumbnails.high?.url ?? v.snippet.thumbnails.default?.url ?? null,
      publishedAt: new Date(v.snippet.publishedAt),
      durationSeconds: parseISO8601Duration(v.contentDetails.duration),
      raw: v,
    }));
  },

  async fetchStats(externalId: string): Promise<StatsSnapshot | null> {
    if (!this.isConfigured()) throw new CollectorNotConfiguredError("youtube");

    const data = await gFetch<VideoListResponse>("videos", {
      part: "statistics",
      id: externalId,
    });
    const v = data.items[0];
    if (!v) return null;

    const s = v.statistics;
    return {
      views: s.viewCount ? Number(s.viewCount) : null,
      likes: s.likeCount ? Number(s.likeCount) : null,
      comments: s.commentCount ? Number(s.commentCount) : null,
      raw: s,
    };
  },
};
