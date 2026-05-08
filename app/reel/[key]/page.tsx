import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { snapshots } from "@/lib/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { getContentGroup } from "@/lib/groups";
import {
  PLATFORM_LABEL,
  PLATFORM_COLOR,
  fmtNum,
  fmtDate,
  DASH,
} from "@/lib/format";
import { TimeseriesChart } from "./chart";

export const dynamic = "force-dynamic";

export default async function ReelPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const decoded = decodeURIComponent(key);
  const group = await getContentGroup(decoded);
  if (!group) notFound();

  // Pull all snapshots across all posts in the group for the chart.
  const postIds = group.platforms.map((p) => p.post.id);
  const series = await db
    .select()
    .from(snapshots)
    .where(inArray(snapshots.postId, postIds))
    .orderBy(asc(snapshots.capturedAt));

  // Bucket snapshots by day so each chart row has a value for every platform
  // that has data on that day. With sparse data, per-timestamp rows leave
  // most platforms undefined and recharts can't draw a continuous line.
  const byDay = new Map<string, Record<string, number>>();
  for (const s of series) {
    const post = group.platforms.find((p) => p.post.id === s.postId);
    if (!post) continue;
    const day = s.capturedAt.toISOString().slice(0, 10); // YYYY-MM-DD
    const row = byDay.get(day) ?? {};
    // Latest value per platform per day wins (snapshots are ordered asc).
    row[post.platform] = Number(s.views ?? 0);
    byDay.set(day, row);
  }
  const chartData = Array.from(byDay.entries())
    .map(([day, row]) => ({ ...row, t: `${day}T12:00:00Z` }))
    .sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime());

  return (
    <main className="min-h-screen px-6 py-10 max-w-5xl mx-auto">
      <Link href="/" className="text-sm text-muted hover:underline">
        ← wszystkie rolki
      </Link>

      <header className="mt-4 mb-8 flex items-start gap-4">
        {group.thumbnailUrl && (
          <Image
            src={group.thumbnailUrl}
            alt=""
            width={120}
            height={68}
            className="rounded-md object-cover w-30 h-17 shrink-0"
            unoptimized
          />
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1 mb-2">
            {group.platforms.map((p) => (
              <a
                key={p.platform}
                href={p.post.url}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex px-2 py-0.5 rounded-full text-xs hover:opacity-80 ${PLATFORM_COLOR[p.platform]}`}
              >
                {PLATFORM_LABEL[p.platform]} ↗
              </a>
            ))}
          </div>
          <h1 className="text-xl font-semibold max-w-2xl">{group.title}</h1>
          <p className="text-xs text-muted mt-1">
            Opublikowano {fmtDate(group.publishedAt)}
          </p>
        </div>
      </header>

      {/* Group totals */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <Card label="Aktualnie (suma)" value={fmtNum(group.totalViews)} />
        <Card label="Po 24h (suma)" value={group.total24h != null ? fmtNum(group.total24h) : DASH} />
        <Card label="Po 7 dniach (suma)" value={group.total7d != null ? fmtNum(group.total7d) : DASH} />
        <Card label="Polubienia" value={fmtNum(group.totalLikes)} />
      </section>

      {/* Per-platform breakdown */}
      <section className="mb-8">
        <h2 className="text-sm font-medium mb-3">Podział na platformy</h2>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-background/50 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Platforma</th>
                <th className="px-4 py-3 font-medium text-right">Aktualnie</th>
                <th className="px-4 py-3 font-medium text-right">Po 24h</th>
                <th className="px-4 py-3 font-medium text-right">Po 7d</th>
                <th className="px-4 py-3 font-medium text-right">Likes</th>
                <th className="px-4 py-3 font-medium text-right">Komentarze</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {group.platforms.map((p) => (
                <tr key={p.platform}>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${PLATFORM_COLOR[p.platform]}`}>
                      {PLATFORM_LABEL[p.platform]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{fmtNum(p.views)}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted">
                    {p.views24h != null ? fmtNum(p.views24h) : DASH}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted">
                    {p.views7d != null ? fmtNum(p.views7d) : DASH}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted">{fmtNum(p.likes)}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted">{fmtNum(p.comments)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium mb-3">Historia views</h2>
        {chartData.length < 2 ? (
          <p className="text-sm text-muted">
            Za mało punktów na wykres. Codzienny snapshot dorzuca kolejne — wróć jutro.
          </p>
        ) : (
          <TimeseriesChart
            data={chartData}
            platforms={group.platforms.map((p) => p.platform)}
          />
        )}
      </section>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl font-semibold mt-1 font-mono">{value}</p>
    </div>
  );
}
