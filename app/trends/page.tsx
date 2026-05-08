import Link from "next/link";
import { listContentGroups, summarize } from "@/lib/groups";
import { fmtNum, DASH } from "@/lib/format";
import { Nav } from "../Nav";
import { ReelsChart, type ReelChartPoint } from "../ReelsChart";
import type { Platform } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type MetricKey = "current" | "24h" | "7d";

const METRIC_LABEL: Record<MetricKey, string> = {
  current: "Aktualnie",
  "24h": "Po 24h",
  "7d": "Po 7d",
};

const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  tiktok: "TikTok",
};

const PLATFORM_COLOR_HEX: Record<Platform, string> = {
  instagram: "#ec4899",
  facebook: "#3b82f6",
  youtube: "#ef4444",
  tiktok: "#10b981",
};

const ORDER: Platform[] = ["instagram", "facebook", "youtube", "tiktok"];

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<{ metric?: string }>;
}) {
  const sp = await searchParams;
  const metric: MetricKey =
    sp.metric === "24h" || sp.metric === "7d" ? sp.metric : "current";

  let groups: Awaited<ReturnType<typeof listContentGroups>> = [];
  let dbError: string | null = null;
  try {
    groups = await listContentGroups({ limit: 200 });
  } catch (e) {
    dbError = (e as Error).message;
  }

  const summary = summarize(groups);

  // Per-platform aggregate totals from latest snapshots.
  const platformTotals: Record<Platform, { views: number; reels: number }> = {
    instagram: { views: 0, reels: 0 },
    facebook: { views: 0, reels: 0 },
    youtube: { views: 0, reels: 0 },
    tiktok: { views: 0, reels: 0 },
  };
  for (const g of groups) {
    for (const p of g.platforms) {
      platformTotals[p.platform].reels++;
      if (p.views != null) platformTotals[p.platform].views += p.views;
    }
  }

  // Build per-reel chart data using the selected metric.
  const valueOf = (
    p: { views: number | null; views24h: number | null; views7d: number | null },
  ): number => {
    if (metric === "24h") return p.views24h ?? 0;
    if (metric === "7d") return p.views7d ?? 0;
    return p.views ?? 0;
  };
  const chartData: ReelChartPoint[] = groups
    .slice()
    .sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime())
    .map((g) => {
      const byP = (plat: Platform) => {
        const stats = g.platforms.find((x) => x.platform === plat);
        return stats ? valueOf(stats) : 0;
      };
      const ig = byP("instagram");
      const fb = byP("facebook");
      const yt = byP("youtube");
      const tt = byP("tiktok");
      return {
        contentKey: g.contentKey,
        title: g.title,
        publishedAt: g.publishedAt.toISOString(),
        instagram: ig,
        facebook: fb,
        youtube: yt,
        tiktok: tt,
        total: ig + fb + yt + tt,
      };
    });

  return (
    <main className="min-h-screen px-6 py-10 max-w-6xl mx-auto">
      <Nav active="trends" />

      {dbError ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="font-medium">Błąd bazy</p>
          <pre className="text-xs text-muted mt-2 overflow-x-auto">{dbError}</pre>
        </div>
      ) : (
        <>
          {/* Per-platform totals */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {ORDER.map((p) => {
              const t = platformTotals[p];
              if (t.reels === 0) return null;
              return (
                <div
                  key={p}
                  className="rounded-lg border border-border bg-card p-4"
                  style={{ borderLeftColor: PLATFORM_COLOR_HEX[p], borderLeftWidth: 3 }}
                >
                  <p className="text-[11px] uppercase tracking-wide text-muted">
                    {PLATFORM_LABEL[p]}
                  </p>
                  <p className="text-xl font-semibold mt-1 font-mono">
                    {fmtNum(t.views)}
                  </p>
                  <p className="text-[10px] text-muted mt-0.5">
                    {t.reels} {t.reels === 1 ? "rolka" : "rolek"}
                  </p>
                </div>
              );
            })}
          </section>

          {/* Per-reel chart */}
          <section className="mb-8">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div>
                <h2 className="text-sm font-medium">
                  Zasięg per rolka — {METRIC_LABEL[metric].toLowerCase()}
                </h2>
                <p className="text-[10px] text-muted mt-0.5">
                  {chartData.length} rolek • najedź na słupek dla szczegółów
                </p>
              </div>
              <div className="flex gap-1 text-xs bg-card rounded-lg p-1 border border-border">
                <MetricLink current={metric} value="current" label="Aktualnie" />
                <MetricLink current={metric} value="24h" label="Po 24h" />
                <MetricLink current={metric} value="7d" label="Po 7d" />
              </div>
            </div>
            {chartData.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-10 text-center">
                <p className="text-sm text-muted">Brak rolek w bazie.</p>
              </div>
            ) : chartData.every((d) => d.total === 0) ? (
              <div className="rounded-lg border border-dashed border-border p-10 text-center">
                <p className="text-sm font-medium">
                  Brak danych dla &ldquo;{METRIC_LABEL[metric]}&rdquo;
                </p>
                <p className="text-xs text-muted mt-2 max-w-md mx-auto">
                  Checkpointy 24h i 7d zaczną się wypełniać w ciągu kolejnych dni.
                  Cron codziennie ~21:30 PL łapie snapshoty rolek po 24h od
                  publikacji i po 7 dniach. Aktualnie mamy świeże dane —
                  przełącz na <span className="font-medium">Aktualnie</span>.
                </p>
              </div>
            ) : (
              <ReelsChart data={chartData} />
            )}
          </section>

          {/* Stats summary */}
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-sm font-medium mb-3">Podsumowanie</h2>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <dt className="text-muted text-xs">Rolek śledzonych</dt>
                <dd className="font-mono font-semibold mt-1">
                  {fmtNum(summary.groupCount)}
                </dd>
              </div>
              <div>
                <dt className="text-muted text-xs">Łącznie views</dt>
                <dd className="font-mono font-semibold mt-1">
                  {fmtNum(summary.totalLifetimeViews)}
                </dd>
              </div>
              <div>
                <dt className="text-muted text-xs">Mediana po 24h</dt>
                <dd className="font-mono font-semibold mt-1">
                  {summary.median24h
                    ? fmtNum(Math.round(summary.median24h))
                    : DASH}
                </dd>
              </div>
              <div>
                <dt className="text-muted text-xs">Mediana po 7d</dt>
                <dd className="font-mono font-semibold mt-1">
                  {summary.median7d
                    ? fmtNum(Math.round(summary.median7d))
                    : DASH}
                </dd>
              </div>
            </dl>
          </section>
        </>
      )}
    </main>
  );
}

function MetricLink({
  current,
  value,
  label,
}: {
  current: MetricKey;
  value: MetricKey;
  label: string;
}) {
  const active = current === value;
  const href = value === "current" ? "/trends" : `/trends?metric=${value}`;
  return (
    <Link
      href={href}
      className={`px-2.5 py-1 rounded transition-colors ${
        active
          ? "bg-foreground text-background"
          : "text-muted hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}
