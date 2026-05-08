import type { Platform } from "../db/schema";

export type DiscoveredPost = {
  platform: Platform;
  externalId: string;
  url: string;
  title?: string | null;
  caption?: string | null;
  thumbnailUrl?: string | null;
  publishedAt: Date;
  durationSeconds?: number | null;
  raw?: unknown;
};

export type StatsSnapshot = {
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  reach?: number | null;
  impressions?: number | null;
  watchTimeSeconds?: number | null;
  avgViewDurationSeconds?: number | null;
  raw?: unknown;
};

export interface Collector {
  platform: Platform;
  isConfigured(): boolean;
  /** Discover recent posts from the channel/account. */
  listRecentPosts(limit?: number): Promise<DiscoveredPost[]>;
  /** Fetch fresh stats for a single known post. */
  fetchStats(externalId: string): Promise<StatsSnapshot | null>;
}

export class CollectorNotConfiguredError extends Error {
  constructor(platform: Platform) {
    super(`Collector for ${platform} is not configured. Add credentials to .env.local`);
    this.name = "CollectorNotConfiguredError";
  }
}
