import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });
import { Pool } from "@neondatabase/serverless";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  // What are the 7 snapshots from May 9?
  const r = await pool.query(`
    SELECT s.captured_at, p.platform, p.title, s.views
    FROM snapshots s JOIN posts p ON s.post_id = p.id
    WHERE s.captured_at::date = '2026-05-09'
    ORDER BY s.captured_at LIMIT 10
  `);
  console.log("May 9 snapshots:");
  for (const row of r.rows) {
    console.log(`  ${row.captured_at.toISOString()} ${row.platform} | ${(row.title ?? "").slice(0, 50)}`);
  }

  // Also check last_fetched_at distribution
  console.log("\nlast_fetched_at distribution per platform:");
  const lf = await pool.query(`
    SELECT platform, MIN(last_fetched_at) AS min_lf, MAX(last_fetched_at) AS max_lf, COUNT(*)::int AS n
    FROM posts GROUP BY platform
  `);
  for (const row of lf.rows) {
    console.log(`  ${row.platform}: ${row.n} posts, last_fetched_at min=${row.min_lf?.toISOString()} max=${row.max_lf?.toISOString()}`);
  }

  // Posts published in last 2 days that we should have discovered
  console.log("\nPosts published in last 2 days:");
  const recent = await pool.query(`
    SELECT platform, title, published_at, last_fetched_at
    FROM posts WHERE published_at > now() - interval '2 days'
    ORDER BY published_at DESC LIMIT 15
  `);
  for (const row of recent.rows) {
    console.log(`  ${row.platform} ${row.published_at.toISOString().slice(0,16)} | ${(row.title ?? "").slice(0, 40)}`);
  }

  await pool.end();
})();
