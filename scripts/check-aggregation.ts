import "dotenv/config";
import { config } from "dotenv";
import { Pool } from "@neondatabase/serverless";

config({ path: ".env.local" });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  // Group by content_key, show platforms in each group
  const { rows } = await pool.query(`
    SELECT
      content_key,
      string_agg(platform::text, ', ' ORDER BY platform::text) AS platforms,
      COUNT(*)::int AS platform_count,
      MIN(published_at) AS first_published,
      (SELECT LEFT(COALESCE(title, caption, ''), 60) FROM posts p2
       WHERE p2.content_key = p.content_key
       ORDER BY length(coalesce(p2.title, p2.caption, '')) DESC LIMIT 1) AS sample_title
    FROM posts p
    WHERE content_key IS NOT NULL
    GROUP BY content_key
    ORDER BY first_published DESC
    LIMIT 30
  `);

  let agg = 0;
  let solo = 0;
  console.log("Content groups (cross-platform aggregation status):\n");
  for (const r of rows) {
    const date = new Date(r.first_published).toLocaleDateString("pl-PL");
    const platformCount = Number(r.platform_count);
    if (platformCount > 1) agg++;
    else solo++;
    const marker = platformCount > 1 ? "✓" : "·";
    console.log(`${marker} [${date}] ${r.platforms}  →  "${r.sample_title}"`);
  }
  console.log(`\n${agg} groups merged across platforms, ${solo} solo posts.`);

  // Total counts per platform
  const { rows: counts } = await pool.query(
    `SELECT platform, COUNT(*)::int AS n FROM posts GROUP BY platform ORDER BY platform`,
  );
  console.log("\nPosts per platform:");
  for (const r of counts) console.log(`  ${r.platform}: ${r.n}`);

  await pool.end();
})();
