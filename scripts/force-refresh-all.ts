import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "@neondatabase/serverless";
import { refreshPostStats } from "../lib/ingest";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const { rows } = await pool.query(
    "SELECT id, platform FROM posts ORDER BY published_at DESC",
  );
  console.log(`Refreshing stats for ${rows.length} posts…`);
  let ok = 0;
  let fail = 0;
  for (const r of rows) {
    try {
      const stats = await refreshPostStats(r.id);
      if (stats) ok++;
      else fail++;
    } catch (e) {
      console.error(`  ✗ ${r.platform} ${r.id}: ${(e as Error).message}`);
      fail++;
    }
  }
  console.log(`\n✓ ${ok} captured, ${fail} failed`);
  await pool.end();
})();
