import "dotenv/config";
import { config } from "dotenv";
import { Pool } from "@neondatabase/serverless";

config({ path: ".env.local" });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const posts = await pool.query(`
    SELECT p.title, p.published_at, s.views, s.likes, s.comments
    FROM posts p
    LEFT JOIN LATERAL (
      SELECT * FROM snapshots WHERE post_id = p.id
      ORDER BY captured_at DESC LIMIT 1
    ) s ON TRUE
    ORDER BY p.published_at DESC
    LIMIT 5
  `);
  console.log("\nTop 5 najnowszych postów:");
  for (const r of posts.rows) {
    const date = new Date(r.published_at).toLocaleDateString("pl-PL");
    console.log(
      `  ${date}  views: ${r.views ?? "—"}  likes: ${r.likes ?? "—"}  | ${r.title?.slice(0, 60)}`,
    );
  }
  const c = await pool.query("SELECT COUNT(*)::int as n FROM posts");
  const s = await pool.query("SELECT COUNT(*)::int as n FROM snapshots");
  console.log(`\nTotal: ${c.rows[0].n} postów, ${s.rows[0].n} snapshotów`);
  await pool.end();
})();
