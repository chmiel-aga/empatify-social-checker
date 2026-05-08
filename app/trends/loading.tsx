import { Nav } from "../Nav";

export default function Loading() {
  return (
    <main className="min-h-screen px-6 py-10 max-w-6xl mx-auto">
      <Nav active="trends" />

      {/* Platform totals skeleton */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-card p-4 animate-pulse"
            style={{ borderLeftWidth: 3 }}
          >
            <div className="h-3 w-20 bg-border rounded" />
            <div className="h-6 w-16 bg-border/60 rounded mt-2" />
            <div className="h-2.5 w-12 bg-border/40 rounded mt-2" />
          </div>
        ))}
      </section>

      {/* Chart skeleton */}
      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-2">
          <div className="h-3.5 w-32 bg-border rounded animate-pulse" />
          <div className="h-2.5 w-48 bg-border/60 rounded animate-pulse" />
        </div>
        <div
          className="rounded-lg border border-border bg-card animate-pulse flex items-end gap-1.5 p-4"
          style={{ height: 420 }}
        >
          {Array.from({ length: 28 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 bg-border/60 rounded-t"
              style={{ height: `${20 + Math.random() * 70}%` }}
            />
          ))}
        </div>
      </section>

      {/* Summary skeleton */}
      <div className="rounded-lg border border-border bg-card p-5 animate-pulse">
        <div className="h-3.5 w-28 bg-border rounded mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-2.5 w-20 bg-border/60 rounded" />
              <div className="h-4 w-16 bg-border rounded" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
