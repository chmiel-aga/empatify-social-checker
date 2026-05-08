import "dotenv/config";
import { config } from "dotenv";
import { Pool } from "@neondatabase/serverless";

config({ path: ".env.local" });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const FB_API = "https://graph.facebook.com/v23.0";
const TOKEN = process.env.FACEBOOK_ACCESS_TOKEN!;

async function fb<T = unknown>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${FB_API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", TOKEN);
  const res = await fetch(url);
  return (await res.json()) as T;
}

(async () => {
  const { rows } = await pool.query(
    `SELECT id, external_id, url FROM posts WHERE platform = 'facebook' ORDER BY published_at DESC LIMIT 3`,
  );

  for (const r of rows) {
    console.log(`\n=== Post ${r.external_id} ===`);
    console.log(`URL: ${r.url}`);

    // 1. Base object — what fields exist?
    const safeFields = "id,permalink_url,description,title,length,from,created_time";
    const base = await fb<Record<string, unknown>>(r.external_id, {
      fields: safeFields,
    });
    console.log("\nBase fields:");
    for (const [k, v] of Object.entries(base)) {
      const display = typeof v === "object" ? JSON.stringify(v).slice(0, 80) : String(v).slice(0, 100);
      console.log(`  ${k}: ${display}`);
    }

    // 1b. Try `views` field directly
    const viewsField = await fb<Record<string, unknown>>(r.external_id, {
      fields: "views",
    });
    console.log(`  Direct 'views' field: ${JSON.stringify(viewsField).slice(0, 120)}`);

    // 2. Try multiple insight metric sets
    const metricSets: { name: string; metrics: string }[] = [
      { name: "video views (total)", metrics: "total_video_views" },
      { name: "video views unique", metrics: "total_video_views_unique" },
      { name: "video impressions", metrics: "total_video_impressions" },
      { name: "complete views", metrics: "total_video_complete_views" },
      { name: "10s views", metrics: "total_video_10s_views" },
      { name: "stuck", metrics: "total_video_stuck_in_position" },
      { name: "organic views", metrics: "total_video_views_organic" },
      { name: "post-level reels", metrics: "post_video_views,post_video_views_unique" },
      { name: "post reactions", metrics: "post_reactions_by_type_total" },
      { name: "page reels metrics", metrics: "page_video_views,page_video_view_time" },
    ];

    for (const { name, metrics } of metricSets) {
      const insights = await fb<{ data?: { name: string; values: { value: number }[] }[]; error?: { message: string } }>(
        `${r.external_id}/video_insights`,
        { metric: metrics },
      );
      if (insights.error) {
        console.log(`  [${name}] ✗ ${insights.error.message.slice(0, 100)}`);
      } else if (insights.data) {
        const values = insights.data.map((d) => `${d.name}=${d.values[0]?.value ?? "?"}`).join(", ");
        console.log(`  [${name}] ✓ ${values || "empty"}`);
      }
    }

    // 3. Also try /insights (post-level)
    const postInsights = await fb<{ data?: unknown[]; error?: { message: string } }>(
      `${r.external_id}/insights`,
      { metric: "post_impressions,post_engaged_users,post_clicks" },
    );
    if (postInsights.error) {
      console.log(`  [post /insights] ✗ ${postInsights.error.message.slice(0, 100)}`);
    } else {
      console.log(`  [post /insights] ✓ ${JSON.stringify(postInsights.data).slice(0, 150)}`);
    }
  }

  await pool.end();
})();
