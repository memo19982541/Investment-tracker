"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDate, pickEvenTicks } from "@/lib/format";

interface Point {
  date: string;
  profit: number;
}

function numberTick(v: number) {
  return v.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

export default function ProfitVsCostChart({ points }: { points: Point[] }) {
  const ticks = useMemo(() => pickEvenTicks(points.map((p) => p.date)), [points]);

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
          <XAxis dataKey="date" ticks={ticks} fontSize={12} stroke="currentColor" opacity={0.6} tickFormatter={formatDate} />
          <YAxis fontSize={12} stroke="currentColor" opacity={0.6} width={70} tickFormatter={numberTick} />
          <Tooltip
            labelFormatter={(label) => formatDate(String(label))}
            formatter={(value) =>
              typeof value === "number"
                ? value.toLocaleString("th-TH", { maximumFractionDigits: 2 })
                : value
            }
          />
          <Line type="monotone" dataKey="profit" name="กำไร/ขาดทุน (เทียบต้นทุน)" stroke="#2563eb" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
