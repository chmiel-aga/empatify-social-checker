import "dotenv/config";
import { config } from "dotenv";
import { Pool } from "@neondatabase/serverless";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
const dir = "drizzle";
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

(async () => {
  for (const f of files) {
    const path = join(dir, f);
    const raw = readFileSync(path, "utf-8");
    // Drizzle uses `--> statement-breakpoint` between statements
    const stmts = raw
      .split(/-->\s*statement-breakpoint/)
      .map((s) => s.trim())
      .filter(Boolean);

    console.log(`\n→ ${f}: ${stmts.length} statements`);
    for (const stmt of stmts) {
      try {
        await pool.query(stmt);
        const head = stmt.split("\n")[0].slice(0, 80);
        console.log(`   ✓ ${head}`);
      } catch (e) {
        const msg = (e as Error).message;
        if (msg.includes("already exists")) {
          console.log(`   ⊙ skip (already exists): ${stmt.split("\n")[0].slice(0, 60)}`);
        } else {
          console.error(`   ✗ ${msg}`);
          throw e;
        }
      }
    }
  }
  console.log("\n✓ migrations applied");
  await pool.end();
})();
