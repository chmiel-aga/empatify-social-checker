import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import { listContentGroups } from "../lib/groups";

(async () => {
  const groups = await listContentGroups({ limit: 200 });
  console.log(`${groups.length} groups\n`);
  for (const g of groups.slice(0, 10)) {
    const date = g.publishedAt.toISOString().slice(0, 10);
    const platforms = g.platforms.map(p => `${p.platform}=${p.views ?? '—'}`).join(' ');
    console.log(`[${date}] sum=${g.totalViews}  ${platforms}  | ${g.title.slice(0, 50)}`);
  }
})();
