import { Nav } from "./Nav";

export default function Loading() {
  return (
    <main className="min-h-screen px-6 py-10 max-w-6xl mx-auto">
      <Nav active="results" />

      {/* KPI bar skeleton */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-card px-4 py-3 animate-pulse"
          >
            <div className="h-3 w-24 bg-border rounded" />
            <div className="h-6 w-16 bg-border/60 rounded mt-2" />
          </div>
        ))}
      </section>

      <div className="flex justify-end mb-3">
        <div className="h-7 w-48 bg-card border border-border rounded-lg animate-pulse" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-b-0 animate-pulse"
          >
            <div className="w-16 h-10 rounded-md bg-border/60 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-3/5 bg-border rounded" />
              <div className="h-2.5 w-2/5 bg-border/60 rounded" />
            </div>
            <div className="hidden sm:flex gap-6">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="h-3 w-10 bg-border/60 rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
