import "dotenv/config";
import { config } from "dotenv";
import { writeFileSync, readFileSync } from "node:fs";

config({ path: ".env.local" });

const USER_TOKEN = process.argv[2];
if (!USER_TOKEN) {
  console.error("Usage: npx tsx scripts/setup-meta.ts <USER_ACCESS_TOKEN>");
  process.exit(1);
}

const FB_API = "https://graph.facebook.com/v23.0";

async function fb<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`${FB_API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", USER_TOKEN);
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`FB API ${res.status}: ${text}`);
  }
  return JSON.parse(text) as T;
}

(async () => {
  console.log("→ Verifying token…");
  const debug = await fb<{
    data: {
      app_id: string;
      expires_at: number;
      data_access_expires_at?: number;
      scopes: string[];
      user_id: string;
      type: string;
    };
  }>("debug_token", { input_token: USER_TOKEN });
  const exp = debug.data.expires_at;
  console.log(`  ✓ App ID: ${debug.data.app_id}`);
  console.log(
    `  ✓ Token type: ${debug.data.type}, expires: ${exp ? new Date(exp * 1000).toLocaleString("pl-PL") : "no expiry"}`,
  );
  console.log(`  ✓ Scopes: ${debug.data.scopes.join(", ")}`);

  console.log("\n→ Fetching pages…");
  const pages = await fb<{
    data: { id: string; name: string; access_token: string; tasks?: string[] }[];
  }>("me/accounts", { fields: "id,name,access_token,tasks" });
  console.log(`  Found ${pages.data.length} page(s):`);
  for (const p of pages.data) console.log(`    - ${p.name} (${p.id})`);
  if (pages.data.length === 0) {
    console.error(
      "\n✗ No pages. Re-do OAuth and select the Empatify page when prompted.",
    );
    process.exit(1);
  }

  const empatify =
    pages.data.find((p) => p.name.toLowerCase().includes("empatify")) ??
    pages.data[0];
  console.log(`\n  → Using page: ${empatify.name} (${empatify.id})`);

  console.log("\n→ Looking up Instagram Business Account on this page…");
  const ig = await fb<{
    instagram_business_account?: { id: string };
  }>(empatify.id, { fields: "instagram_business_account" });
  if (!ig.instagram_business_account) {
    console.error("\n✗ No Instagram Business Account linked to this page.");
    console.error(
      "  Fix: in Facebook Page settings → Linked accounts → connect IG Business/Creator.",
    );
    process.exit(1);
  }
  const igId = ig.instagram_business_account.id;

  const igProfile = await fb<{ username?: string; id: string }>(igId, {
    fields: "id,username",
  });
  console.log(`  ✓ IG Business: @${igProfile.username ?? "(no username)"} — ID ${igId}`);

  console.log("\n→ Quick test: list latest IG media…");
  const media = await fb<{
    data: {
      id: string;
      media_type: string;
      media_product_type?: string;
      timestamp: string;
    }[];
  }>(`${igId}/media`, {
    fields: "id,media_type,media_product_type,timestamp",
    limit: "5",
  });
  console.log(`  ✓ ${media.data.length} most recent IG posts:`);
  for (const m of media.data) {
    console.log(
      `    - ${m.media_product_type ?? m.media_type} on ${new Date(m.timestamp).toLocaleDateString("pl-PL")}`,
    );
  }

  console.log("\n→ Quick test: list latest FB page videos/reels…");
  const fbReels = await fb<{
    data: { id: string; created_time: string; description?: string }[];
  }>(`${empatify.id}/video_reels`, {
    fields: "id,created_time,description",
    limit: "5",
  }).catch(async () =>
    fb<{ data: { id: string; created_time: string; description?: string }[] }>(
      `${empatify.id}/videos`,
      { fields: "id,created_time,description", limit: "5" },
    ),
  );
  console.log(`  ✓ ${fbReels.data.length} most recent FB videos:`);
  for (const v of fbReels.data) {
    console.log(`    - ${new Date(v.created_time).toLocaleDateString("pl-PL")}`);
  }

  console.log("\n→ Writing values to .env.local…");
  const envPath = ".env.local";
  let env = readFileSync(envPath, "utf-8");
  const upsert = (key: string, value: string) => {
    const re = new RegExp(`^${key}="[^"]*"(\\s*#.*)?$`, "m");
    const line = `${key}="${value}"`;
    if (re.test(env)) {
      env = env.replace(re, line);
    } else {
      env += `\n${line}`;
    }
  };
  upsert("FACEBOOK_PAGE_ID", empatify.id);
  upsert("FACEBOOK_ACCESS_TOKEN", empatify.access_token);
  upsert("INSTAGRAM_BUSINESS_ACCOUNT_ID", igId);
  upsert("INSTAGRAM_ACCESS_TOKEN", empatify.access_token);
  writeFileSync(envPath, env);
  console.log("  ✓ Saved FACEBOOK_PAGE_ID, FACEBOOK_ACCESS_TOKEN");
  console.log("  ✓ Saved INSTAGRAM_BUSINESS_ACCOUNT_ID, INSTAGRAM_ACCESS_TOKEN");

  console.log(
    "\n✓ Done. The page access token never expires (long-lived by default for FB Pages).",
  );
})();
