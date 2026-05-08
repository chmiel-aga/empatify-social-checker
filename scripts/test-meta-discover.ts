import "dotenv/config";
import { config } from "dotenv";

config({ path: ".env.local" });

import { syncPlatform } from "../lib/ingest";
import { Pool } from "@neondatabase/serverless";
import { refreshPostStats } from "../lib/ingest";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  console.log("→ Discovering Instagram (captureInitial=true)…");
  const ig = await syncPlatform("instagram", { limit: 25, captureInitial: true });
  console.log(`  ${JSON.stringify(ig)}`);

  console.log("\n→ Discovering Facebook (captureInitial=true)…");
  try {
    const fb = await syncPlatform("facebook", { limit: 25, captureInitial: true });
    console.log(`  ${JSON.stringify(fb)}`);
  } catch (err) {
    console.log(`  (FB skipped: ${(err as Error).message})`);
  }

  // Refresh stats explicitly for any existing IG/FB posts that may have failed earlier
  console.log("\n→ Refreshing stats for all IG and FB posts…");
  const { rows } = await pool.query(
    "SELECT id, platform FROM posts WHERE platform IN ('instagram','facebook') ORDER BY published_at DESC",
  );
  let ok = 0;
  let fail = 0;
  for (const r of rows) {
    try {
      const stats = await refreshPostStats(r.id);
      if (stats) ok++;
      else fail++;
    } catch {
      fail++;
    }
  }
  console.log(`  ✓ ${ok} stats captured, ${fail} failed`);

  // Show sample data
  const sample = await pool.query(`
    SELECT p.platform, p.title, s.views, s.likes, s.comments
    FROM posts p
    LEFT JOIN LATERAL (
      SELECT * FROM snapshots WHERE post_id = p.id ORDER BY captured_at DESC LIMIT 1
    ) s ON TRUE
    WHERE p.platform IN ('instagram','facebook')
    ORDER BY p.published_at DESC LIMIT 6
  `);
  console.log("\nSample (latest 6 IG/FB posts):");
  for (const r of sample.rows) {
    console.log(
      `  [${r.platform}] views: ${r.views ?? "—"}, likes: ${r.likes ?? "—"}, comments: ${r.comments ?? "—"} | ${(r.title ?? "(no title)").slice(0, 50)}`,
    );
  }

  await pool.end();
  console.log("\n✓ Done.");
})();
