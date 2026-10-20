"use client";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { lossAwareBar, LOSS_STROKE } from "@/components/lossBar";
import { formatDate, formatMoney, pickEvenTicks } from "@/lib/format";

export interface ProfitPoint {
  date: string;
  /** Cumulative gain/loss already booked by selling, up to this date. */
  realized: number;
  /** Gain/loss on what's still held (value − cost) at this date. */
  unrealized: number;
}

const REALIZED_COLOR = "#15803d";
const UNREALIZED_COLOR = "#86efac";

// Gains are solid fills; a loss is drawn empty with a red outline (see lossAwareBar).
function solidBar(fill: string) {
  return function SolidBar({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
    return <rect x={x} y={y} width={width} height={height} fill={fill} />;
  };
}
const RealizedBar = lossAwareBar("realized", solidBar(REALIZED_COLOR));
const UnrealizedBar = lossAwareBar("unrealized", solidBar(UNREALIZED_COLOR));

const SERIES_NAMES: Record<string, string> = {
  realized: "กำไร/ขาดทุนที่ขายแล้ว (realized)",
  unrealized: "กำไร/ขาดทุนที่ยังถืออยู่ (unrealized)",
  total: "รวม",
};

function numberTick(v: number) {
  return v.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

function signed(n: number) {
  return `${n >= 0 ? "+" : ""}${formatMoney(n)}`;
}

/**
 * Total gain/loss as stacked bars: what has been realized by selling plus what
 * is still unrealized on the holdings. Selling moves profit from one bar
 * segment to the other instead of making it vanish, and the line shows their sum.
 */
export default function ProfitVsCostChart({ points }: { points: ProfitPoint[] }) {
  const data = useMemo(
    () => points.map((p) => ({ ...p, total: p.realized + p.unrealized })),
    [points]
  );
  const ticks = useMemo(() => pickEvenTicks(data.map((p) => p.date)), [data]);
  const latest = data[data.length - 1];

  return (
    <>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
            <XAxis
              dataKey="date"
              ticks={ticks}
              fontSize={12}
              stroke="currentColor"
              opacity={0.6}
              tickFormatter={formatDate}
            />
            <YAxis fontSize={12} stroke="currentColor" opacity={0.6} width={70} tickFormatter={numberTick} />
            <ReferenceLine y={0} stroke="currentColor" opacity={0.35} />
            <Tooltip
              labelFormatter={(label) => formatDate(String(label))}
              formatter={(value, name) => [
                typeof value === "number" ? signed(value) : value,
                SERIES_NAMES[String(name)] ?? name,
              ]}
            />
            <Bar dataKey="realized" stackId="profit" fill={REALIZED_COLOR} shape={RealizedBar} />
            <Bar dataKey="unrealized" stackId="profit" fill={UNREALIZED_COLOR} shape={UnrealizedBar} />
            <Line
              type="monotone"
              dataKey="total"
              stroke="currentColor"
              strokeWidth={2}
              dot={false}
              opacity={0.7}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-black/60 dark:text-white/60">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: REALIZED_COLOR }} />
          {SERIES_NAMES.realized}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: UNREALIZED_COLOR }} />
          {SERIES_NAMES.unrealized}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm border"
            style={{ borderColor: LOSS_STROKE }}
          />
          ขาดทุน (ไม่มีสี กรอบแดง)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-current opacity-70" />
          รวม
        </span>
      </div>
      {latest && (
        <p className="text-xs text-black/60 dark:text-white/60">
          ล่าสุด ({formatDate(latest.date)}): ขายแล้ว {signed(latest.realized)} + ยังถืออยู่{" "}
          {signed(latest.unrealized)} ={" "}
          <span className={latest.total >= 0 ? "text-green-600" : "text-red-600"}>
            {signed(latest.total)}
          </span>
        </p>
      )}
    </>
  );
}
