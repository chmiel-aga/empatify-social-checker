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

const PLATFORM_HEX: Record<Platform, string> = {
  youtube: "#ef4444",
  instagram: "#ec4899",
  facebook: "#3b82f6",
  tiktok: "#10b981",
};

const LABEL: Record<Platform, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
};

export function TimeseriesChart({
  data,
  platforms,
}: {
  data: Record<string, number | string>[];
  platforms: Platform[];
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
          <XAxis
            dataKey="t"
            tickFormatter={(v) =>
              new Date(v).toLocaleDateString("pl-PL", { month: "short", day: "numeric" })
            }
            stroke="var(--muted)"
            fontSize={11}
          />
          <YAxis stroke="var(--muted)" fontSize={11} />
          <Tooltip
            labelFormatter={(v) => new Date(v).toLocaleString("pl-PL")}
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {platforms.map((p) => (
            <Line
              key={p}
              type="monotone"
              dataKey={p}
              name={LABEL[p]}
              stroke={PLATFORM_HEX[p]}
              strokeWidth={2}
              dot={{ r: 3, fill: PLATFORM_HEX[p] }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
