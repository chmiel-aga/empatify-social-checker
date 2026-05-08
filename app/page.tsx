import Link from "next/link";
import Image from "next/image";
import {
  listContentGroups,
  summarize,
  isViral,
  type PlatformStats,
} from "@/lib/groups";
import {
  PLATFORM_LABEL,
  PLATFORM_COLOR,
  fmtNum,
  fmtDate,
  DASH,
} from "@/lib/format";
import type { Platform } from "@/lib/db/schema";
import { Nav } from "./Nav";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Display order: Meta family (IG + FB) first, then YouTube, TikTok last.
const ALL_PLATFORMS: Platform[] = ["instagram", "facebook", "youtube", "tiktok"];
const PLATFORM_SHORT: Record<Platform, string> = {
  instagram: "IG",
  facebook: "FB",
  youtube: "YT",
  tiktok: "TT",
};
type SortKey = "recent" | "popular" | "growing";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; hideSum?: string }>;
}) {
  const sp = await searchParams;
  const sort = ((sp.sort as SortKey) || "recent") as SortKey;
  const showSum = sp.hideSum !== "1";

  let groups: Awaited<ReturnType<typeof listContentGroups>> = [];
  let dbError: string | null = null;
  try {
    groups = await listContentGroups({ limit: 100 });
  } catch (e) {
    dbError = (e as Error).message;
  }

  // Sort
  if (sort === "popular") {
    groups.sort((a, b) => (b.totalViews ?? 0) - (a.totalViews ?? 0));
  } else if (sort === "growing") {
    groups.sort((a, b) => {
      const ga = (a.total7d ?? 0) - (a.total24h ?? 0);
      const gb = (b.total7d ?? 0) - (b.total24h ?? 0);
      return gb - ga;
    });
  }

  const summary = summarize(groups);

  return (
    <main className="min-h-screen px-6 py-10 max-w-6xl mx-auto">
      <Nav active="results" />

      {/* KPI bar */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Kpi label="Rolek śledzonych" value={fmtNum(summary.groupCount)} />
        <Kpi
          label="Mediana po 24h"
          value={summary.median24h ? fmtNum(Math.round(summary.median24h)) : DASH}
          hint="łącznie po platformach"
        />
        <Kpi
          label="Mediana po 7d"
          value={summary.median7d ? fmtNum(Math.round(summary.median7d)) : DASH}
        />
        <Kpi
          label="Łącznie views"
          value={fmtNum(summary.totalLifetimeViews)}
          hint="cykl życia, wszystkie platformy"
        />
      </section>

      {/* Sort + Suma toggle */}
      <div className="flex flex-wrap items-center justify-end gap-2 mb-3">
        {!showSum && (
          <Link
            href={
              sort !== "recent" ? `/?sort=${sort}` : "/"
            }
            className="text-xs px-2.5 py-1.5 rounded-md text-muted hover:text-foreground hover:bg-card border border-transparent hover:border-border transition-colors"
            title="Pokaż kolumnę Suma"
          >
            + Suma
          </Link>
        )}
        <div className="flex gap-1 text-xs bg-card rounded-lg p-1 border border-border">
          <SortLink current={sort} value="recent" label="Najnowsze" />
          <SortLink current={sort} value="popular" label="Popularne" />
          <SortLink current={sort} value="growing" label="Rosnące" />
        </div>
      </div>

      {dbError ? (
        <SetupNotice error={dbError} />
      ) : groups.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-x-auto">
          <p className="px-4 pt-3 pb-1 text-[10px] text-muted">
            W komórkach: <span className="font-medium">aktualnie</span> /{" "}
            <span>po 24h</span> / <span>po 7d</span>
          </p>
          <table className="w-full text-sm">
            <thead className="bg-background/50 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Rolka</th>
                {ALL_PLATFORMS.map((plat) => (
                  <th
                    key={plat}
                    className="px-3 py-3 font-medium text-right"
                    title={PLATFORM_LABEL[plat]}
                  >
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${PLATFORM_COLOR[plat]}`}
                    >
                      {PLATFORM_SHORT[plat]}
                    </span>
                  </th>
                ))}
                {showSum && (
                  <th className="px-4 py-3 font-medium text-right border-l border-border">
                    <div className="flex items-center justify-end gap-2">
                      <span>Suma</span>
                      <SumToggleLink sort={sort} />
                    </div>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {groups.map((g) => {
                const viral = isViral(g, summary.viralThreshold);
                const linkHref = `/reel/${encodeURIComponent(g.contentKey)}`;
                const byPlatform = (p: Platform) =>
                  g.platforms.find((x) => x.platform === p);
                return (
                  <tr key={g.contentKey} className="hover:bg-background/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {g.thumbnailUrl ? (
                          <Link href={linkHref} className="shrink-0">
                            <Image
                              src={g.thumbnailUrl}
                              alt=""
                              width={64}
                              height={36}
                              className="rounded-md object-cover w-16 h-10"
                              unoptimized
                            />
                          </Link>
                        ) : (
                          <div className="w-16 h-10 rounded-md bg-background shrink-0" />
                        )}
                        <div className="min-w-0">
                          <Link
                            href={linkHref}
                            className="font-medium hover:underline line-clamp-2 max-w-md block"
                          >
                            {g.title}
                          </Link>
                          {g.subtitles.length > 0 && (
                            <div className="mt-0.5 space-y-0.5 max-w-md">
                              {g.subtitles.map((s, i) => (
                                <p
                                  key={i}
                                  className="text-xs text-muted/80 line-clamp-1"
                                >
                                  <span
                                    className={`inline-block px-1 rounded text-[9px] mr-1 align-middle ${PLATFORM_COLOR[s.platform]}`}
                                  >
                                    {PLATFORM_SHORT[s.platform]}
                                  </span>
                                  {s.text}
                                </p>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-muted">
                              {fmtDate(g.publishedAt)}
                            </span>
                            {viral && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-orange-500/15 text-orange-500 dark:text-orange-300">
                                🔥 Viral
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    {ALL_PLATFORMS.map((plat) => (
                      <PlatformCell key={plat} stats={byPlatform(plat)} />
                    ))}
                    {showSum && (
                      <td className="px-4 py-3 text-right font-mono leading-tight border-l border-border">
                        <div className="font-semibold">
                          {fmtNum(g.totalViews)}
                        </div>
                        <div className="text-[10px] text-muted/70 mt-0.5">
                          {g.total24h != null ? fmtNum(g.total24h) : DASH}
                          <span className="mx-0.5 text-muted/40">/</span>
                          {g.total7d != null ? fmtNum(g.total7d) : DASH}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function SumToggleLink({ sort }: { sort: SortKey }) {
  const params = new URLSearchParams();
  if (sort !== "recent") params.set("sort", sort);
  params.set("hideSum", "1");
  const href = `/?${params}`;
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center w-5 h-5 rounded text-[10px] text-muted hover:text-foreground hover:bg-background transition-colors"
      title="Ukryj kolumnę Suma"
    >
      ×
    </Link>
  );
}

function PlatformCell({ stats }: { stats: PlatformStats | undefined }) {
  if (!stats) {
    return (
      <td className="px-3 py-3 text-right font-mono text-muted/40">{DASH}</td>
    );
  }
  const tip = `${PLATFORM_LABEL[stats.platform]}\nAktualnie: ${fmtNum(stats.views)}\nPo 24h: ${stats.views24h != null ? fmtNum(stats.views24h) : DASH}\nPo 7d: ${stats.views7d != null ? fmtNum(stats.views7d) : DASH}\nLikes: ${fmtNum(stats.likes)}\nKomentarze: ${fmtNum(stats.comments)}`;
  return (
    <td className="px-3 py-3 text-right font-mono leading-tight" title={tip}>
      <div className="font-medium">{fmtNum(stats.views)}</div>
      <div className="text-[10px] text-muted/70 mt-0.5">
        {stats.views24h != null ? fmtNum(stats.views24h) : DASH}
        <span className="mx-0.5 text-muted/40">/</span>
        {stats.views7d != null ? fmtNum(stats.views7d) : DASH}
      </div>
    </td>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="text-xl font-semibold mt-1 font-mono">{value}</p>
      {hint && <p className="text-[10px] text-muted mt-0.5">{hint}</p>}
    </div>
  );
}

function SortLink({
  current,
  value,
  label,
}: {
  current: SortKey;
  value: SortKey;
  label: string;
}) {
  const active = current === value;
  const params = new URLSearchParams();
  if (value !== "recent") params.set("sort", value);
  const href = params.toString() ? `/?${params}` : "/";
  return (
    <Link
      href={href}
      className={`px-2.5 py-1 rounded transition-colors ${
        active ? "bg-foreground text-background" : "text-muted hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border p-10 text-center">
      <p className="font-medium">Brak rolek w bazie.</p>
      <p className="text-sm text-muted mt-2">
        Uruchom endpoint /api/cron/discover żeby pobrać posty.
      </p>
    </div>
  );
}

function SetupNotice({ error }: { error: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <p className="font-medium">Baza nie jest jeszcze gotowa</p>
      <p className="text-sm text-muted mt-2">
        Ustaw <code>DATABASE_URL</code> i uruchom <code>npm run db:migrate</code>.
      </p>
      <pre className="text-xs text-muted mt-3 bg-background p-3 rounded overflow-x-auto">
        {error}
      </pre>
    </div>
  );
}
