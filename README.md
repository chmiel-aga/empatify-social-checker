# Empatify Social Checker

Tracking dashboard for short-form video performance across YouTube, Instagram, Facebook, and TikTok. Built for [Empatify](https://www.empatify.app/) — a Polish app on emotional self-regulation — to compare reel performance across platforms and surface what works.

**Live:** [empatify-social-checker.vercel.app](https://empatify-social-checker.vercel.app)

![Stack: Next.js 16, TypeScript, Postgres (Neon), Drizzle ORM, Vercel Cron, Recharts](https://img.shields.io/badge/Stack-Next.js%2016%20·%20TS%20·%20Postgres%20·%20Drizzle%20·%20Recharts-0a0a0a)

## What it does

Empatify publishes the same reel across YouTube, Instagram, and Facebook (each with platform-specific copy). The dashboard answers:

- **Where did this reel land best?** Per-platform breakdown for every post: current views, "after 24h", "after 7 days".
- **Which reel went viral?** Adaptive viral threshold (≥ 2× median total views).
- **How is each platform performing over time?** Per-reel stacked bar chart with metric toggle (current / 24h / 7d).

A daily cron at 21:30 PL captures stats. New reels enter the system without an initial snapshot — their first measurement happens 24h later, so the "Po 24h" checkpoint is precise rather than approximate.

## Architectural decisions worth noting

### Cross-platform reel aggregation
The same logical reel is one row in the table, even when the platforms use different titles/captions. Done in two passes in [`lib/groups.ts`](lib/groups.ts):

1. **Same-day smart-match**: posts published on the same Polish day with ≤1 post per platform → merge into one group. If multiple posts per platform that day, fall back to title-fingerprint splitting.
2. **Cross-day greedy match**: leftover YouTube-only and Instagram/Facebook-only "orphan" groups within ±2 days are paired by closest date. This handles Empatify's pattern of cross-posting reels a day apart.

### Time-series captured cleanly
Snapshots are stored per `(post_id, captured_at)`. The "Po 24h" / "Po 7d" values are derived by picking the snapshot closest to `publishedAt + 24h` (resp. `+ 7d`) within ±2h tolerance — a simple but durable design.

### Never-expiring page tokens via long-lived exchange
Meta page tokens derived from a long-lived user token never expire. The flow lives in [`scripts/exchange-meta-token.ts`](scripts/exchange-meta-token.ts): short-lived user token → long-lived (60 days) → Page tokens (permanent).

### FB Reels quirk
Page Reels don't return values via `/video_insights` despite accepting the `total_video_views` metric. Workaround: query the `views` field directly on the reel object. Documented inline in [`lib/collectors/facebook.ts`](lib/collectors/facebook.ts).

### Performance: batched DB queries
The naive implementation issued ~3 round-trips per content group (latest snapshot, 24h checkpoint, 7d checkpoint). Refactored to 4 batched queries total via `IN (...)` and JS-side bucketing in [`lib/groups.ts`](lib/groups.ts): `getLatestSnapshotsByPost`, `getCheckpointsByPost`. Local page render dropped from ~3s to ~250ms.

## Project structure

```
app/
  page.tsx                  — Dashboard: per-reel, per-platform table
  trends/page.tsx           — Stacked bar chart with metric toggle
  reel/[key]/page.tsx       — Single reel detail + per-platform breakdown
  api/cron/discover/        — Daily cron: discover + snapshot
  api/cron/snapshot/        — Manual snapshot (no longer scheduled)
  loading.tsx               — Skeleton loaders per route

lib/
  db/                       — Drizzle schema + Neon HTTP client
  collectors/               — Per-platform integrations
    youtube.ts              — Data API v3, full impl
    instagram.ts            — Graph API, with metric fallbacks
    facebook.ts             — Page Reels via direct `views` field
    tiktok.ts               — Display API stub (OAuth pending)
  groups.ts                 — Smart-match grouping + cross-day fallback
  ingest.ts                 — Discover + refresh orchestration
  metrics.ts                — Checkpoint resolution helpers
  platform-trends.ts        — Time-series aggregation queries
  content-key.ts            — Content fingerprinting + Polish-day helpers

scripts/
  migrate.ts                — Apply Drizzle migrations
  setup-meta.ts             — Bootstrap from a user token
  exchange-meta-token.ts    — Short → long-lived token + page tokens
  push-env-to-vercel.sh     — Sync .env.local to Vercel envs
```

## Setup

```bash
npm install
cp .env.example .env.local
# fill in DATABASE_URL, CRON_SECRET, platform credentials
npm run db:migrate
npm run dev
```

Initial backfill of Empatify's content:

```bash
source .env.local
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/discover
```

## Tech stack

- **Next.js 16** App Router + Turbopack
- **TypeScript** (strict)
- **Tailwind CSS 4**
- **Postgres** (Neon, free tier) + **Drizzle ORM**
- **Recharts** for visualization
- **Vercel** hosting + **Vercel Cron** for daily ingest

## Deployment

Auto-deployed via Vercel on push to `main`. Manual deploy:

```bash
vercel deploy --prod
```

## License

Internal tool. Not for redistribution.
