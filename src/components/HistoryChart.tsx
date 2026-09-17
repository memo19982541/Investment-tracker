"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Point {
  date: string;
  totalValue: number;
  totalCost: number;
}

export default function HistoryChart({ points }: { points: Point[] }) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
          <XAxis dataKey="date" fontSize={12} stroke="currentColor" opacity={0.6} />
          <YAxis
            fontSize={12}
            stroke="currentColor"
            opacity={0.6}
            width={70}
            tickFormatter={(v: number) => v.toLocaleString("th-TH")}
          />
          <Tooltip
            formatter={(value) =>
              typeof value === "number"
                ? value.toLocaleString("th-TH", { maximumFractionDigits: 2 })
                : value
            }
          />
          <Line
            type="monotone"
            dataKey="totalValue"
            name="มูลค่าพอร์ตรวม"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="totalCost"
            name="ทุนรวม"
            stroke="#dc2626"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
