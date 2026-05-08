import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });
import { listContentGroups } from "../lib/groups";

(async () => {
  const groups = await listContentGroups({ limit: 200 });
  for (const g of groups) {
    const ig = g.platforms.find(p => p.platform === "instagram")?.views ?? 0;
    const fb = g.platforms.find(p => p.platform === "facebook")?.views ?? 0;
    if (ig > 50000 || fb > 30000) {
      const date = g.publishedAt.toISOString().slice(0, 10);
      console.log(`[${date}] IG=${ig} FB=${fb} | "${g.title.slice(0, 60)}"`);
      console.log(`  contentKey: ${g.contentKey}`);
      console.log(`  posts in group: ${g.platforms.length}`);
      for (const p of g.platforms) {
        console.log(`    ${p.platform} views=${p.views} likes=${p.likes} | post.id=${p.post.id}`);
      }
    }
  }
})();
