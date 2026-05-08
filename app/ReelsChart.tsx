"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import type { Platform } from "@/lib/db/schema";

const COLORS: Record<Platform, string> = {
  instagram: "#ec4899",
  facebook: "#3b82f6",
  youtube: "#ef4444",
  tiktok: "#10b981",
};

const LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  tiktok: "TikTok",
};

const ORDER: Platform[] = ["instagram", "facebook", "youtube", "tiktok"];

export type ReelChartPoint = {
  contentKey: string;
  title: string;
  publishedAt: string; // ISO
  instagram: number;
  facebook: number;
  youtube: number;
  tiktok: number;
  total: number;
};

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("pl-PL").format(n);
}

export function ReelsChart({ data }: { data: ReelChartPoint[] }) {
  // Only show platforms that actually have non-zero values across the dataset
  const activePlatforms = ORDER.filter((p) =>
    data.some((d) => (d[p] ?? 0) > 0),
  );

  return (
    <div className="rounded-lg border border-border bg-card p-4" style={{ height: 420 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 12, left: 0, bottom: 32 }}
          barCategoryGap={4}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            opacity={0.4}
            vertical={false}
          />
          <XAxis
            dataKey="publishedAt"
            tickFormatter={(v) =>
              new Date(v).toLocaleDateString("pl-PL", {
                day: "numeric",
                month: "short",
              })
            }
            stroke="var(--muted)"
            fontSize={10}
            interval="preserveStartEnd"
            angle={-30}
            textAnchor="end"
            tickMargin={8}
          />
          <YAxis
            stroke="var(--muted)"
            fontSize={11}
            tickFormatter={fmtCompact}
            width={48}
          />
          <Tooltip
            cursor={{ fill: "var(--accent)", opacity: 0.08 }}
            content={<ReelTooltip />}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            verticalAlign="top"
          />
          {activePlatforms.map((p, idx) => (
            <Bar
              key={p}
              dataKey={p}
              name={LABELS[p]}
              stackId="reach"
              fill={COLORS[p]}
              radius={
                idx === activePlatforms.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]
              }
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type TooltipProps = {
  active?: boolean;
  payload?: { payload: ReelChartPoint }[];
};

function ReelTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  const date = new Date(d.publishedAt).toLocaleDateString("pl-PL", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const platforms: { p: Platform; v: number }[] = ORDER.map((p) => ({
    p,
    v: d[p] ?? 0,
  })).filter((x) => x.v > 0);

  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 text-xs shadow-lg max-w-xs">
      <p className="font-medium leading-tight mb-1 line-clamp-3">{d.title}</p>
      <p className="text-muted text-[10px] mb-2">{date}</p>
      <div className="space-y-0.5">
        {platforms.map(({ p, v }) => (
          <div key={p} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-sm"
                style={{ background: COLORS[p] }}
              />
              <span className="text-muted">{LABELS[p]}</span>
            </span>
            <span className="font-mono">{fmtNum(v)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 border-t border-border pt-1 mt-1">
          <span className="font-medium">Suma</span>
          <span className="font-mono font-semibold">{fmtNum(d.total)}</span>
        </div>
      </div>
    </div>
  );
}
