import "dotenv/config";
import { config } from "dotenv";
import { Pool } from "@neondatabase/serverless";

config({ path: ".env.local" });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const KEY = "2026-04-29__do której grupy ci bliżej";

(async () => {
  const { rows: posts } = await pool.query(
    `SELECT id, platform FROM posts WHERE content_key = $1`,
    [KEY],
  );
  console.log("Posts in group:", posts.length);
  for (const p of posts) {
    const { rows: snaps } = await pool.query(
      `SELECT captured_at, views FROM snapshots WHERE post_id = $1 ORDER BY captured_at`,
      [p.id],
    );
    console.log(`\n${p.platform}: ${snaps.length} snapshots`);
    for (const s of snaps) {
      const day = new Date(s.captured_at).toISOString().slice(0, 10);
      console.log(`  ${day}  views=${s.views}`);
    }
  }
  await pool.end();
})();
