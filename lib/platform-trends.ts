import { db } from "./db";
import { sql } from "drizzle-orm";
import type { Platform } from "./db/schema";

export type TrendPoint = {
  day: string; // YYYY-MM-DD
} & Partial<Record<Platform, number>>;

/**
 * Daily aggregated views per platform.
 *
 * For each day in the window, for each post on that platform, we use the
 * latest snapshot captured AT OR BEFORE end-of-day. Then sum across posts.
 * This shows total platform reach evolving over time — robust to days where
 * not every post got a fresh snapshot (the previous day's value carries over).
 */
export async function getPlatformTrends(days = 14): Promise<TrendPoint[]> {
  const result = await db.execute(sql`
    WITH RECURSIVE day_series AS (
      SELECT (now() AT TIME ZONE 'Europe/Warsaw')::date - (${days} - 1) AS day
      UNION ALL
      SELECT day + 1 FROM day_series
      WHERE day < (now() AT TIME ZONE 'Europe/Warsaw')::date
    ),
    -- For each (day, post), take the latest snapshot value as of end-of-day PL.
    post_day_views AS (
      SELECT
        d.day,
        p.platform,
        p.id AS post_id,
        (SELECT s.views
           FROM snapshots s
           WHERE s.post_id = p.id
             AND s.captured_at <= (d.day + 1) AT TIME ZONE 'Europe/Warsaw'
             AND s.views IS NOT NULL
           ORDER BY s.captured_at DESC
           LIMIT 1) AS views
      FROM day_series d
      CROSS JOIN posts p
      WHERE p.published_at <= (d.day + 1) AT TIME ZONE 'Europe/Warsaw'
    )
    SELECT
      to_char(day, 'YYYY-MM-DD') AS day,
      platform::text AS platform,
      SUM(COALESCE(views, 0))::bigint AS total
    FROM post_day_views
    GROUP BY day, platform
    HAVING SUM(COALESCE(views, 0)) > 0
    ORDER BY day
  `);

  const byDay = new Map<string, TrendPoint>();
  for (const row of result.rows as {
    day: string;
    platform: Platform;
    total: string;
  }[]) {
    if (!byDay.has(row.day)) byDay.set(row.day, { day: row.day });
    byDay.get(row.day)![row.platform] = Number(row.total);
  }
  return Array.from(byDay.values()).sort((a, b) =>
    a.day.localeCompare(b.day),
  );
}
