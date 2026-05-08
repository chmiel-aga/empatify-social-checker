export function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}k`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return new Intl.NumberFormat("pl-PL").format(n);
}

export function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n == null || !isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

export function fmtRelative(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "przed chwilą";
  if (diff < 3600) return `${Math.round(diff / 60)} min temu`;
  if (diff < 86400) return `${Math.round(diff / 3600)} godz. temu`;
  if (diff < 7 * 86400) return `${Math.round(diff / 86400)} dni temu`;
  if (diff < 30 * 86400) return `${Math.round(diff / 7 / 86400)} tyg. temu`;
  return d.toLocaleDateString("pl-PL");
}

/**
 * Concrete publication date — short Polish format, e.g. "10 maja 2026".
 * Drops the year if it matches current year for compactness ("10 maja").
 */
export function fmtDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: sameYear ? undefined : "numeric",
  });
}

/** Empty-state placeholder. Use everywhere instead of "brak danych" / "—" inline. */
export const DASH = "—";

export function fmtDelta(
  later: number | null | undefined,
  earlier: number | null | undefined,
): { abs: number | null; pct: number | null } {
  if (later == null || earlier == null) return { abs: null, pct: null };
  const abs = later - earlier;
  const pct = earlier === 0 ? null : abs / earlier;
  return { abs, pct };
}

export const PLATFORM_LABEL: Record<string, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  facebook: "Facebook",
  instagram: "Instagram",
};

export const PLATFORM_COLOR: Record<string, string> = {
  youtube: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  tiktok: "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900",
  facebook: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  instagram: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
};
