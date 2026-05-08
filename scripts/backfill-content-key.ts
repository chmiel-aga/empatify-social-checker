import "dotenv/config";
import { config } from "dotenv";
import { Pool } from "@neondatabase/serverless";
import { computeContentKey } from "../lib/content-key";

config({ path: ".env.local" });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const { rows } = await pool.query(
    "SELECT id, title, published_at FROM posts WHERE content_key IS NULL",
  );
  console.log(`Backfilling content_key on ${rows.length} posts...`);
  for (const r of rows) {
    const key = computeContentKey(r.title, new Date(r.published_at));
    await pool.query("UPDATE posts SET content_key = $1 WHERE id = $2", [
      key,
      r.id,
    ]);
    console.log(`  ${key}  ←  ${(r.title ?? "").slice(0, 60)}`);
  }
  console.log("✓ done");
  await pool.end();
})();
