import "dotenv/config";
import { config } from "dotenv";
import { Pool } from "@neondatabase/serverless";

config({ path: ".env.local" });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  // Delete mock posts (cascade removes their snapshots)
  const posts = await pool.query(
    `DELETE FROM posts WHERE raw->>'_mock' = 'true' RETURNING id`,
  );
  // Delete mock snapshots attached to real posts (the YT 24h/7d backfills)
  const snaps = await pool.query(
    `DELETE FROM snapshots WHERE raw->>'_mock' = 'true' RETURNING id`,
  );
  console.log(`✓ Removed ${posts.rows.length} mock posts`);
  console.log(`✓ Removed ${snaps.rows.length} mock snapshots`);
  await pool.end();
})();
