import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import { getPlatformTrends } from "../lib/platform-trends";

(async () => {
  const trends = await getPlatformTrends(14);
  console.log(`Got ${trends.length} days of data:`);
  for (const t of trends) {
    console.log(JSON.stringify(t));
  }
})();
