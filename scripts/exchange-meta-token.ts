import "dotenv/config";
import { config } from "dotenv";
import { writeFileSync, readFileSync } from "node:fs";

config({ path: ".env.local" });

const USER_TOKEN = process.argv[2];
const APP_SECRET = process.argv[3] ?? process.env.META_APP_SECRET;

if (!USER_TOKEN || !APP_SECRET) {
  console.error(
    "Usage: npx tsx scripts/exchange-meta-token.ts <USER_TOKEN> <APP_SECRET>",
  );
  process.exit(1);
}

const FB_API = "https://graph.facebook.com/v23.0";

async function fb<T>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const url = new URL(`${FB_API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(`FB ${res.status}: ${text}`);
  return JSON.parse(text) as T;
}

(async () => {
  console.log("→ Verifying input user token…");
  const debug = await fb<{
    data: { app_id: string; user_id: string; expires_at: number };
  }>("debug_token", { input_token: USER_TOKEN, access_token: USER_TOKEN });
  const APP_ID = debug.data.app_id;
  const userExpiry = debug.data.expires_at;
  console.log(`  ✓ App ID: ${APP_ID}`);
  console.log(
    `  ✓ Current user-token expiry: ${userExpiry ? new Date(userExpiry * 1000).toLocaleString("pl-PL") : "no expiry"}`,
  );

  console.log("\n→ Exchanging short-lived → long-lived user token…");
  const exchange = await fb<{
    access_token: string;
    token_type: string;
    expires_in?: number;
  }>("oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: APP_ID,
    client_secret: APP_SECRET,
    fb_exchange_token: USER_TOKEN,
  });
  const days = exchange.expires_in
    ? Math.round(exchange.expires_in / 86400)
    : "?";
  console.log(`  ✓ Long-lived user token obtained (~${days} days)`);

  console.log("\n→ Fetching page tokens (will be never-expiring)…");
  const pages = await fb<{
    data: { id: string; name: string; access_token: string }[];
  }>("me/accounts", {
    fields: "id,name,access_token",
    access_token: exchange.access_token,
  });
  const empatify =
    pages.data.find((p) => p.name.toLowerCase().includes("empatify")) ??
    pages.data[0];
  if (!empatify) {
    console.error("✗ No pages on this account");
    process.exit(1);
  }
  console.log(`  ✓ Page: ${empatify.name} (${empatify.id})`);

  console.log("\n→ Verifying page-token expiry…");
  const verify = await fb<{ data: { expires_at: number } }>("debug_token", {
    input_token: empatify.access_token,
    access_token: exchange.access_token,
  });
  if (verify.data.expires_at === 0) {
    console.log(`  ✓ Page token: never expires ✨`);
  } else {
    console.log(
      `  ⚠ Page token expires: ${new Date(verify.data.expires_at * 1000).toLocaleString("pl-PL")}`,
    );
  }

  console.log("\n→ Updating .env.local…");
  let env = readFileSync(".env.local", "utf-8");
  const upsert = (key: string, value: string) => {
    const re = new RegExp(`^${key}="[^"]*"(\\s*#.*)?$`, "m");
    if (re.test(env)) env = env.replace(re, `${key}="${value}"`);
    else env += `\n${key}="${value}"`;
  };
  upsert("FACEBOOK_ACCESS_TOKEN", empatify.access_token);
  upsert("INSTAGRAM_ACCESS_TOKEN", empatify.access_token);
  upsert("META_APP_ID", APP_ID);
  upsert("META_APP_SECRET", APP_SECRET);
  writeFileSync(".env.local", env);
  console.log(
    "  ✓ Saved FACEBOOK_ACCESS_TOKEN + INSTAGRAM_ACCESS_TOKEN (long-lived)",
  );
  console.log("  ✓ Saved META_APP_ID + META_APP_SECRET (for future refresh)");
})();
