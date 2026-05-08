import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { snapshots } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { getPostWithCheckpoints } from "@/lib/metrics";
import {
  PLATFORM_LABEL,
  PLATFORM_COLOR,
  fmtNum,
  fmtPct,
  fmtRelative,
  fmtDelta,
} from "@/lib/format";
import { TimeseriesChart } from "./chart";

export const dynamic = "force-dynamic";

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getPostWithCheckpoints(id);
  if (!data) notFound();
  const { post, latest, at24h, at7d } = data;

  const series = await db
    .select()
    .from(snapshots)
    .where(eq(snapshots.postId, id))
    .orderBy(asc(snapshots.capturedAt));

  const delta24to7 = fmtDelta(at7d?.snapshot.views, at24h?.snapshot.views);

  return (
    <main className="min-h-screen px-6 py-10 max-w-5xl mx-auto">
      <Link href="/" className="text-sm text-muted hover:underline">
        ← wszystkie posty
      </Link>

      <header className="mt-4 mb-8 flex items-start justify-between gap-6">
        <div>
          <span
            className={`inline-flex px-2 py-0.5 rounded-full text-xs ${PLATFORM_COLOR[post.platform]}`}
          >
            {PLATFORM_LABEL[post.platform]}
          </span>
          <h1 className="text-xl font-semibold mt-2 max-w-2xl">
            {post.title || post.caption?.slice(0, 100) || post.externalId}
          </h1>
          <p className="text-xs text-muted mt-1">
            Opublikowano {fmtRelative(post.publishedAt)} ·{" "}
            <a
              href={post.url}
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
            >
              oryginał ↗
            </a>
          </p>
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card label="Po 24h" snap={at24h} />
        <Card label="Po 7 dniach" snap={at7d} />
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted">Aktualnie</p>
          <p className="text-2xl font-semibold mt-1 font-mono">
            {fmtNum(latest?.views)}
          </p>
          <p className="text-xs text-muted mt-1">
            {latest ? fmtRelative(latest.capturedAt) : "—"}
          </p>
        </div>
      </section>

      {at24h && at7d && (
        <section className="rounded-lg border border-border bg-card p-4 mb-8 text-sm">
          <p className="text-muted text-xs uppercase tracking-wide mb-2">
            Wzrost między 24h a 7d
          </p>
          <p className="text-lg">
            <span className="font-mono">{fmtNum(delta24to7.abs ?? 0)}</span>{" "}
            <span className="text-muted">
              ({fmtPct(delta24to7.pct)} względem checkpointu 24h)
            </span>
          </p>
        </section>
      )}

      <section>
        <h2 className="text-sm font-medium mb-3">Historia (wszystkie snapshoty)</h2>
        {series.length < 2 ? (
          <p className="text-sm text-muted">
            Za mało punktów, żeby narysować wykres. Cron zbiera snapshoty co godzinę.
          </p>
        ) : (
          <TimeseriesChart
            data={series.map((s) => ({
              t: s.capturedAt.toISOString(),
              views: Number(s.views ?? 0),
              likes: Number(s.likes ?? 0),
              comments: Number(s.comments ?? 0),
            }))}
          />
        )}
      </section>
    </main>
  );
}

function Card({
  label,
  snap,
}: {
  label: string;
  snap: Awaited<ReturnType<typeof getPostWithCheckpoints>> extends infer T
    ? T extends { at24h: infer S }
      ? S
      : never
    : never;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl font-semibold mt-1 font-mono">
        {snap ? fmtNum(snap.snapshot.views) : "—"}
      </p>
      <p className="text-xs text-muted mt-1">
        {snap
          ? `± ${Math.abs(Math.round(snap.deltaMs / 3600 / 1000))}h od celu`
          : "snapshot jeszcze niezebrany"}
      </p>
    </div>
  );
}
