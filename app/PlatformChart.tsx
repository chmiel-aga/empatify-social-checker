"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import type { Platform } from "@/lib/db/schema";
import type { TrendPoint } from "@/lib/platform-trends";

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

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

export function PlatformChart({ data }: { data: TrendPoint[] }) {
  // Only show platforms that actually have data in the series
  const activePlatforms = ORDER.filter((p) =>
    data.some((d) => typeof d[p] === "number"),
  );

  return (
    <div className="rounded-lg border border-border bg-card p-4 h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            opacity={0.4}
          />
          <XAxis
            dataKey="day"
            tickFormatter={(v) =>
              new Date(v).toLocaleDateString("pl-PL", {
                month: "short",
                day: "numeric",
              })
            }
            stroke="var(--muted)"
            fontSize={11}
          />
          <YAxis
            stroke="var(--muted)"
            fontSize={11}
            tickFormatter={fmtCompact}
          />
          <Tooltip
            labelFormatter={(v) =>
              new Date(v).toLocaleDateString("pl-PL", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })
            }
            formatter={(v: number) => fmtCompact(v)}
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {activePlatforms.map((p) => (
            <Line
              key={p}
              type="monotone"
              dataKey={p}
              name={LABELS[p]}
              stroke={COLORS[p]}
              strokeWidth={2}
              dot={{ r: 4, stroke: COLORS[p], strokeWidth: 2, fill: "var(--background)" }}
              activeDot={{ r: 6 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
