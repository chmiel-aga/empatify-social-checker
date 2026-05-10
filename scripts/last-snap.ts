import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });
import { Pool } from "@neondatabase/serverless";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const r = await pool.query(`
    SELECT date_trunc('day', captured_at) AS day, COUNT(*)::int AS n
    FROM snapshots
    GROUP BY day ORDER BY day DESC LIMIT 7
  `);
  for (const row of r.rows) {
    console.log(`${new Date(row.day).toISOString().slice(0,10)}: ${row.n} snapshots`);
  }
  await pool.end();
})();
