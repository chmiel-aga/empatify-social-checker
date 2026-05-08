# Empatify Social Checker — stan projektu

## Co to jest
Tracker rolek Empatify na YouTube, Instagram, Facebook i TikTok. Codzienny snapshot 24h/7d po publikacji + aktualne views. Cross-platform aggregation (jedna logiczna rolka = jedna pozycja).

## Live
- **Produkcja**: https://empatify-social-checker.vercel.app
- **GitHub**: https://github.com/chmiel-aga/empatify-social-checker (public, portfolio-ready)
- **Linked Vercel project**: `chmielagn-4118s-projects/empatify-social-checker`
- **Auto-deploy**: GitHub `main` → Vercel production (no more manual `vercel deploy`)
- **DB**: Neon Postgres (free tier), connection w `DATABASE_URL`
- **Cron**: codziennie `30 19 * * *` UTC = 21:30 PL (lato) / 20:30 PL (zima). Hobby plan = 1 cron/day.

## Stack
- Next.js 16 App Router + Turbopack
- Tailwind 4
- Drizzle ORM + Neon serverless
- Recharts (wykresy)
- Vercel deployment + cron

## Stan integracji platform

| Platforma | Status | Notatki |
|---|---|---|
| YouTube | ✅ pełna | Data API v3, klucz API, channel ID Empatify `UCskfqEIKutOp3MkvRePM1Ig` |
| Instagram | ✅ pełna | Meta Graph API v23.0, IG Business Account `17841445589691147` (@_empatify_) |
| Facebook | ✅ pełna | FB Page ID `743541616061478`, views przez bezpośrednie pole `views` na reel obiekcie (nie video_insights) |
| TikTok | ⏳ w toku | User tworzy developer account + app, wraca z Client Key/Secret |

## Tokeny i sekrety (w `.env.local` + Vercel env)

- `DATABASE_URL` — Neon connection
- `CRON_SECRET` — 64 hex chars, do auth crona
- `YOUTUBE_API_KEY`, `YOUTUBE_CHANNEL_ID`
- `INSTAGRAM_ACCESS_TOKEN` (= page token, never-expires)
- `INSTAGRAM_BUSINESS_ACCOUNT_ID`
- `FACEBOOK_ACCESS_TOKEN` (= page token, never-expires; ten sam co IG)
- `FACEBOOK_PAGE_ID`
- `META_APP_ID`, `META_APP_SECRET` — do refresh long-lived w przyszłości
- `TIKTOK_ACCESS_TOKEN`, `TIKTOK_OPEN_ID` — puste, do wypełnienia

**Page tokens IG+FB nie wygasają** (pochodzą z long-lived user tokena, exchange zrobiony przez `scripts/exchange-meta-token.ts`).

## Kluczowe decyzje architektoniczne

### Agregacja cross-platform: smart-match per dzień + cross-day fallback
- Każda rolka ma `content_key` w bazie (`YYYY-MM-DD__title fingerprint`) — DEPRECATED, kolumna nie używana w grupowaniu
- W app layer (`lib/groups.ts` → `smartGroup`): grupowanie per polishDay
  - Jeśli każda platforma ma ≤1 post tego dnia → merge wszystkich w jedną grupę
  - Jeśli któraś ma >1 → split przez title fingerprint
- **Cross-day fallback** (`mergeCrossDayOrphans`): drugi pass scala YT-orphan z IG/FB-orphan w oknie ±2 dni używając greedy bipartite matching (najbliższe pary datą najpierw, każda strona consumed po match)
  - Empatify czasem postuje YT i IG/FB w różnych dniach — to scali ten sam content
  - Tylko orphans (single-platform groups), więc bezpieczne dla multi-platform-same-day
- Cross-platform pokazuje subtitles z różnymi tytułami pod głównym

### Snapshoty
- Discover w cronie nie zapisuje initial snapshotu (`captureInitial: false`)
- Pierwszy snapshot dla nowej rolki dopiero następnego dnia o 21:30 = checkpoint **24h**
- Po 7 dniach = checkpoint **7d**
- Tolerancja ±2h dla checkpointów (`CHECKPOINT_TOLERANCE` w `lib/groups.ts`)
- Każdy następny dzień = nowy snapshot dla rolek nieaktualizowanych >22h

### Viral badge
- Próg: `totalViews >= 2 × mediana wszystkich grup`
- Adaptive — rośnie wraz z grow Empatify

## Routes

- `/` — tabela rolek z per-platform views (current/24h/7d w komórce, suma toggleable przez `?hideSum=1`, sort `?sort=recent|popular|growing`)
- `/trends` — kafelki per platforma + stacked bar chart "Zasięg per rolka". Toggle metryki `?metric=current|24h|7d`
- `/reel/[contentKey]` — szczegóły rolki: per-platform breakdown table + wykres time-series (recharts ma issues z renderowaniem przy sparsowych danych — działa w produkcji)
- `/post/[id]` — legacy direct link do pojedynczego posta (nie linkowane z UI)
- `/api/cron/discover` — daily cron: discover + snapshot. Wymaga `Authorization: Bearer $CRON_SECRET`
- `/api/cron/snapshot` — manual refresh, nie scheduled

## Performance
- DB queries zbatchowane przez `getLatestSnapshotsByPost` + `getCheckpointsByPost` w `lib/groups.ts`
- Lokalnie home ~750ms, trends ~210ms
- Produkcja ~2.5s pierwszy hit (cold start + Neon EU latency)
- `loading.tsx` w `app/` i `app/trends/` — szkielet podczas SSR

## UI conventions
- Display order platform: **Instagram, Facebook, YouTube, TikTok** (Meta family razem)
- Skróty: IG / FB / YT / TT
- Tab nav (Wyniki / Trendy) **pod tytułem po lewej** (nie obok tytułu)
- Komórka platformy: duża cyfra (current views) + małe `24h / 7d` poniżej
- Suma column: tak samo (current + małe 24h/7d), toggleable przez ×
- **Daty publikacji**: konkretne (np. "26 kwietnia", "10 maja"), nie "X dni temu". Helper `fmtDate()` w `lib/format.ts` — drop year jeśli current year

## Skrypty (`scripts/`)
- `migrate.ts` — ręczna migracja SQL (omija interaktywny drizzle-kit push)
- `setup-meta.ts` — z user tokena: wyciąga page token + IG ID, pisze do .env.local
- `exchange-meta-token.ts` — short-lived → long-lived user token → never-expiring page token (wymaga app secret)
- `seed-mock-platforms.ts` / `clear-mock-platforms.ts` — mock data dla cross-platform testów
- `push-env-to-vercel.sh` — pcha .env.local do Vercel (production + development)
- `check.ts`, `debug-*.ts`, `check-aggregation.ts`, `debug-fb-stats.ts`, `debug-trends.ts`, `debug-groups.ts`, `debug-max.ts`, `debug-outlier.ts` — debug scripts

## Następne kroki (kolejność)

### 1. Integracja TikTok ⏳ (user w trakcie)
- User tworzy konto deweloperskie + app na https://developers.tiktok.com
- Daje mi Client Key + Client Secret
- Ja buduję `/api/auth/tiktok/start` + `/api/auth/tiktok/callback` (OAuth flow)
- Stub `/privacy` (TikTok wymaga URL polityki prywatności)
- User klika OAuth raz → tokeny zapisują się do env
- Test discover, redeploy
- TikTok tokens: access 24h (refresh-owalny), refresh 365d
- Sandbox mode wystarczy (tracking własnej zawartości, nie potrzebujemy app review)
- Plan: `lib/collectors/tiktok.ts` jest już stub'em; trzeba podpiąć refresh logic

### 2. Migracja na System User Token (po stabilizacji TT)
- Empatify musi mieć Business Manager (darmowy)
- System User → tokeny nigdy nie wygasają (vs obecne page tokens które są "never expire" ale zależą od user tokena)
- Production-grade, omija ryzyko "co jeśli admin FB zmieni hasło"

### 3. Możliwe ficzery (gdyby user prosił)
- Search bar w tabeli (gdy będzie 100+ rolek)
- Eksport CSV
- Email/Slack alerty viral
- Sortowanie tabeli po platformie
- Chart per-reel cumulative running total (zamiast per-reel discrete)

## Znane problemy / quirks

- **Recharts + sparse data**: linie nie renderują się gdy mamy 1 punkt danych. Workaround: `isAnimationActive={false}` + jawny dot styling. Działa.
- **FB views**: dla Reels nie zwracają wartości przez `/video_insights` endpoint — używamy bezpośrednio pola `views` na obiekcie reel'a. Dla regular videos wciąż fallback na video_insights.
- **IG `plays` deprecated**: zmienione na `views` (Meta API ~2024). Mamy fallback try/catch w insights.
- **content_key** kolumna dalej w schemacie ale **nie używana do grupowania** — smart-match w app layer ją zastąpił. Można w przyszłości usunąć, ale low priority.
- **Hobby plan limit**: 1 cron/day. Jeśli upgrade do Pro ($20/mo) — można dodać hourly snapshot dla świeżych postów (live tracking pierwszej doby).
- **Empatify FB Page**: posty to **Reels** (`/reel/{id}/`), nie regular videos. Stąd specyficzne traktowanie w `lib/collectors/facebook.ts`.

## User feedback patterns (zachowuj te decyzje)

- **Krótkie kroki**, nie wielkie kawałki naraz
- **Screenshoty pomagają** w trudnych momentach (Meta Console, TikTok)
- **Po polsku**, zwięźle, konkretnie
- **Nie pytaj o pozwolenie na 5 rzeczy naraz** — proponuj A/B/C/D, user wybiera
- **Pokazuj co robisz** + screenshot rezultatu, nie tylko opis
- **Nie ukrywaj problemów** — np. recharts bug z sparse data, fakt że Empatify FB to reels
- **Reality check** kosztów (Hobby vs Pro), DST, ryzyko App Review na różnych platformach
