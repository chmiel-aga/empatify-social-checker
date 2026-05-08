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

type Point = { t: string; views: number; likes: number; comments: number };

export function TimeseriesChart({ data }: { data: Point[] }) {
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
          <Line type="monotone" dataKey="views" stroke="var(--accent)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="likes" stroke="#ec4899" strokeWidth={1.5} dot={false} />
          <Line
            type="monotone"
            dataKey="comments"
            stroke="#10b981"
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
