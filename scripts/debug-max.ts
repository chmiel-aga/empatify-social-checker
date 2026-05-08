import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });
import { listContentGroups } from "../lib/groups";

(async () => {
  const groups = await listContentGroups({ limit: 200 });
  let maxStack = 0;
  let maxIg = 0, maxFb = 0, maxYt = 0;
  for (const g of groups) {
    const ig = g.platforms.find(p => p.platform === "instagram")?.views ?? 0;
    const fb = g.platforms.find(p => p.platform === "facebook")?.views ?? 0;
    const yt = g.platforms.find(p => p.platform === "youtube")?.views ?? 0;
    const stack = ig + fb + yt;
    if (stack > maxStack) maxStack = stack;
    if (ig > maxIg) maxIg = ig;
    if (fb > maxFb) maxFb = fb;
    if (yt > maxYt) maxYt = yt;
  }
  console.log(`Max stack (single reel): ${maxStack}`);
  console.log(`Max IG single: ${maxIg}`);
  console.log(`Max FB single: ${maxFb}`);
  console.log(`Max YT single: ${maxYt}`);
})();
