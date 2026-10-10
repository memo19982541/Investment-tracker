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
import { formatDate, formatMoney, pickEvenTicks } from "@/lib/format";

export interface ValuePoint {
  date: string;
  /** Net money put in so far (cost basis minus the gains already realized). */
  capital: number;
  /** Cumulative gain/loss booked by selling. */
  realized: number;
  /** Gain/loss on what's still held. */
  unrealized: number;
}

// The money-put-in and unrealized bars fade from their colour at the top to
// off-white at the bottom (see GradientBar). Not pure white, so the faded end
// doesn't vanish into a white page.
const FADE_BOTTOM = "#fdfbfb";
const CAPITAL_TOP = "#f6afc7";
const UNREALIZED_TOP = "#9cf797";
const REALIZED_COLOR = "#dd81a4";
// Deeper than the realized pink so the capital line stands out against the bars.
const CAPITAL_LINE = "#be185d";
const CAPITAL_GRADIENT_ID = "capitalGradient";
const UNREALIZED_GRADIENT_ID = "unrealizedGradient";
// One faint grey outline for every bar so they keep their shape where the pink fades out.
const BAR_STROKE = "#9ca3af";
const BAR_STROKE_OPACITY = 0.35;

const SERIES_NAMES: Record<string, string> = {
  capital: "เงินทุน (เงินเติมสุทธิ)",
  realized: "กำไร/ขาดทุนที่ขายแล้ว",
  unrealized: "กำไร/ขาดทุนที่ยังถืออยู่",
  value: "มูลค่าพอร์ตรวม",
};

function numberTick(v: number) {
  return v.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

/**
 * Where the value axis starts. The money put in dwarfs the gains, so starting
 * at 0 flattens everything; instead cut the empty lower part off, leaving a
 * little room under the lowest bar top. Rounded down to a tidy step, and
 * never below 0.
 */
function axisFloorFor(points: { capital: number; realized: number; unrealized: number }[]) {
  if (points.length === 0) return 0;
  const tops = points.flatMap((p) => [p.capital, p.capital + p.realized + p.unrealized]);
  const lo = Math.min(...tops);
  const hi = Math.max(...tops, 0);
  const span = Math.max(hi - lo, hi * 0.05, 1);
  const step = 10 ** Math.floor(Math.log10(span / 2));
  return Math.max(0, Math.floor((lo - span * 0.3) / step) * step);
}

function signed(n: number) {
  return `${n >= 0 ? "+" : ""}${formatMoney(n)}`;
}

interface BarShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

/**
 * A bar shape filled with its own top-to-bottom gradient, so each bar fades
 * over exactly its own height. Recharts already clips a bar at the axis
 * floor, so the bottom edge is the faded end. Negative values arrive with a
 * negative height; flip those so they still draw.
 */
function gradientBar(gradientId: string) {
  return function GradientBar({ x = 0, y = 0, width = 0, height = 0 }: BarShapeProps) {
    if (height === 0) return null;
    return (
      <rect
        x={x}
        y={height < 0 ? y + height : y}
        width={width}
        height={Math.abs(height)}
        fill={`url(#${gradientId})`}
        stroke={BAR_STROKE}
        strokeOpacity={BAR_STROKE_OPACITY}
        strokeWidth={1}
      />
    );
  };
}

const CapitalBar = gradientBar(CAPITAL_GRADIENT_ID);
const UnrealizedBar = gradientBar(UNREALIZED_GRADIENT_ID);

// Each tooltip row takes its series' colour. The pale fills (the fading capital
// and unrealized bars) are unreadable as text, so those rows use the deeper
// shade of the same hue: the capital line's pink, and a mid green.
const UNREALIZED_TEXT = "#2f9e2c";

interface TooltipProps {
  active?: boolean;
  payload?: { payload?: ValuePoint & { value: number } }[];
}

function ValueTooltip({ active, payload }: TooltipProps) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const items: { label: string; text: string; color?: string }[] = [
    { label: SERIES_NAMES.capital, text: formatMoney(row.capital), color: CAPITAL_LINE },
    { label: SERIES_NAMES.realized, text: signed(row.realized), color: REALIZED_COLOR },
    { label: SERIES_NAMES.unrealized, text: signed(row.unrealized), color: UNREALIZED_TEXT },
    { label: SERIES_NAMES.value, text: formatMoney(row.value) },
  ];
  return (
    <div className="rounded border border-black/15 bg-white px-3 py-2 text-sm text-black shadow-sm">
      <p className="mb-1 font-medium">{formatDate(row.date)}</p>
      {items.map((it) => (
        <p key={it.label} style={it.color ? { color: it.color } : undefined}>
          {it.label} : {it.text}
        </p>
      ))}
    </div>
  );
}

/**
 * Portfolio value as stacked bars: the money put in, plus what's been gained
 * by selling, plus what's gained on the holdings (negative gains drop below
 * zero). The line is the total value, so a loss that stacks below zero still
 * reads against the real value.
 */
export default function ValueBreakdownChart({ points }: { points: ValuePoint[] }) {
  const data = useMemo(
    () => points.map((p) => ({ ...p, value: p.capital + p.realized + p.unrealized })),
    [points]
  );
  const ticks = useMemo(() => pickEvenTicks(data.map((p) => p.date)), [data]);
  const axisFloor = useMemo(() => axisFloorFor(data), [data]);
  const latest = data[data.length - 1];

  return (
    <>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={CAPITAL_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CAPITAL_TOP} />
                <stop offset="100%" stopColor={FADE_BOTTOM} />
              </linearGradient>
              <linearGradient id={UNREALIZED_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={UNREALIZED_TOP} />
                <stop offset="100%" stopColor={FADE_BOTTOM} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
            <XAxis
              dataKey="date"
              ticks={ticks}
              fontSize={12}
              stroke="currentColor"
              opacity={0.6}
              tickFormatter={formatDate}
            />
            <YAxis
              domain={[axisFloor, "auto"]}
              allowDataOverflow
              fontSize={12}
              stroke="currentColor"
              opacity={0.6}
              width={70}
              tickFormatter={numberTick}
            />
            {axisFloor === 0 && <ReferenceLine y={0} stroke="currentColor" opacity={0.35} />}
            <Tooltip content={<ValueTooltip />} />
            <Bar dataKey="capital" stackId="value" fill={CAPITAL_TOP} shape={CapitalBar} />
            <Bar
              dataKey="realized"
              stackId="value"
              fill={REALIZED_COLOR}
              stroke={BAR_STROKE}
              strokeOpacity={BAR_STROKE_OPACITY}
            />
            <Bar dataKey="unrealized" stackId="value" fill={UNREALIZED_TOP} shape={UnrealizedBar} />
            <Line
              type="monotone"
              dataKey="capital"
              stroke={CAPITAL_LINE}
              strokeWidth={2.5}
              dot={false}
              tooltipType="none"
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="currentColor"
              strokeWidth={2}
              dot={false}
              opacity={0.7}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-black/60 dark:text-white/60">
        {(
          [
            ["capital", `linear-gradient(to bottom, ${CAPITAL_TOP}, ${FADE_BOTTOM})`],
            ["realized", REALIZED_COLOR],
            ["unrealized", `linear-gradient(to bottom, ${UNREALIZED_TOP}, ${FADE_BOTTOM})`],
          ] as const
        ).map(([key, background]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm border border-black/10 dark:border-white/20"
              style={{ background }}
            />
            {SERIES_NAMES[key]}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4" style={{ backgroundColor: CAPITAL_LINE }} />
          เส้นเงินทุน
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-current opacity-70" />
          {SERIES_NAMES.value}
        </span>
      </div>
      {latest && (
        <p className="text-xs text-black/60 dark:text-white/60">
          {axisFloor > 0 && <>แกนเริ่มที่ {numberTick(axisFloor)} (ตัดช่วงล่างออกเพื่อให้เห็นความต่าง) · </>}
          ล่าสุด ({formatDate(latest.date)}): เงินทุน {formatMoney(latest.capital)} + ขายแล้ว{" "}
          {signed(latest.realized)} + ยังถืออยู่ {signed(latest.unrealized)} ={" "}
          <span className="font-medium">{formatMoney(latest.value)}</span>
        </p>
      )}
    </>
  );
}
