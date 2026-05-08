/**
 * Cross-platform reel matching.
 *
 * Empatify publishes the same reel across YouTube/IG/FB/TikTok within the
 * same day (peak ~20:00 PL). We compute a `content_key` from the publish
 * day in Polish time + a fingerprint of the normalized title. Posts that
 * share the key are treated as one logical reel in the UI.
 */

const PL_TZ_OFFSET_HOURS = 1; // CET; CEST shift handled below

/** Returns YYYY-MM-DD for the date in Europe/Warsaw timezone. */
export function polishDay(date: Date): string {
  // Determine if date is in CEST (DST) by checking if it's in March-October
  // window. Cheap heuristic; for our purposes the boundary days don't matter.
  const m = date.getUTCMonth(); // 0-11
  const isCEST = m >= 2 && m <= 9; // Mar–Oct
  const offsetMs = (PL_TZ_OFFSET_HOURS + (isCEST ? 1 : 0)) * 3600 * 1000;
  const local = new Date(date.getTime() + offsetMs);
  return local.toISOString().slice(0, 10);
}

/**
 * Normalize a title to a stable fingerprint:
 *  - lowercase, strip emoji + punctuation, collapse whitespace
 *  - take first 6 alphanumeric tokens (enough to disambiguate)
 *
 * Trade-off: identical reels on YT/IG with cosmetic caption differences
 * (e.g. trailing #hashtags) will match. Genuinely different reels published
 * the same day will likely have different first 6 words → won't collide.
 */
export function titleFingerprint(title: string | null | undefined): string {
  const raw = (title ?? "").toLowerCase();
  const words = raw
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  return words.slice(0, 6).join(" ").slice(0, 80);
}

export function computeContentKey(
  title: string | null | undefined,
  publishedAt: Date,
): string {
  const day = polishDay(publishedAt);
  const fp = titleFingerprint(title);
  return `${day}__${fp}`;
}
