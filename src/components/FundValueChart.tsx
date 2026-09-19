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
import { buildFundSeries } from "@/lib/analytics";
import { formatDate, pickEvenTicks } from "@/lib/format";
import type { FundLogEntry } from "@/lib/types";

function numberTick(v: number) {
  return v.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

// Tightly wraps the actual value range (3% padding) instead of a 0-anchored
// axis, which otherwise leaves most of the chart as dead space.
const TIGHT_DOMAIN: [(min: number) => number, (max: number) => number] = [
  (min) => Math.floor(min * 0.97),
  (max) => Math.ceil(max * 1.03),
];

/**
 * Accumulated holding value in a single fund over time (units × price at
 * each recorded snapshot) — how much money is sitting in this fund, not its
 * NAV or buy/sell history (that's `FundPriceChart`, used on /transactions).
 */
export default function FundValueChart({
  assetId,
  fundLog,
}: {
  assetId: string;
  fundLog: FundLogEntry[];
}) {
  const points = useMemo(
    () => (assetId ? buildFundSeries(fundLog, assetId) : []),
    [fundLog, assetId]
  );
  const ticks = useMemo(() => pickEvenTicks(points.map((p) => p.date)), [points]);

  const emptyClass = "py-10 text-center text-sm text-black/50 dark:text-white/50";

  if (!assetId) return <p className={emptyClass}>เลือกกองทุนเพื่อดูมูลค่าสะสม</p>;
  if (points.length === 0)
    return (
      <p className={emptyClass}>
        ยังไม่มีประวัติมูลค่า กด &quot;บันทึกราคา&quot; ในหน้าอัปเดตราคาเพื่อเริ่มเก็บข้อมูล
      </p>
    );

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
          <XAxis dataKey="date" ticks={ticks} fontSize={12} stroke="currentColor" opacity={0.6} tickFormatter={formatDate} />
          <YAxis domain={TIGHT_DOMAIN} allowDataOverflow fontSize={12} stroke="currentColor" opacity={0.6} width={70} tickFormatter={numberTick} />
          <Tooltip
            labelFormatter={(label) => formatDate(String(label))}
            formatter={(value) =>
              typeof value === "number"
                ? value.toLocaleString("th-TH", { maximumFractionDigits: 2 })
                : value
            }
          />
          <Line type="monotone" dataKey="value" name="มูลค่าสะสม" stroke="#2563eb" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
