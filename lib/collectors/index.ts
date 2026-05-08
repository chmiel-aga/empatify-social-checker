import type { Platform } from "../db/schema";
import type { Collector } from "./types";
import { youtubeCollector } from "./youtube";
import { instagramCollector } from "./instagram";
import { facebookCollector } from "./facebook";
import { tiktokCollector } from "./tiktok";

export const collectors: Record<Platform, Collector> = {
  youtube: youtubeCollector,
  instagram: instagramCollector,
  facebook: facebookCollector,
  tiktok: tiktokCollector,
};

export function configuredPlatforms(): Platform[] {
  return (Object.keys(collectors) as Platform[]).filter((p) =>
    collectors[p].isConfigured(),
  );
}
