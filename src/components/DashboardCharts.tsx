"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import FundValueChart from "@/components/FundValueChart";
import ProfitVsCostChart from "@/components/ProfitVsCostChart";
import {
  buildCategorySeries,
  computeNoTradeSeries,
  type CategorySeriesPoint,
} from "@/lib/analytics";
import { formatDate, formatMoney, pickEvenTicks } from "@/lib/format";
import { cutoffDateFor, PERIOD_LABELS, type Period } from "@/lib/period";
import type { Asset, Currency, FundLogEntry, Snapshot, Transaction } from "@/lib/types";

type View =
  | "total"
  | "category"
  | "fund"
  | "notrade"
  | "profit"
  | "profitVsCost"
  | "allocation";

const VIEW_LABELS: Record<View, string> = {
  total: "รวม",
  category: "แยกตามพอร์ต",
  fund: "แยกรายกองทุน",
  notrade: "เทรด vs ไม่เทรด",
  profit: "กำไรเทียบฐาน",
  profitVsCost: "กำไรเทียบต้นทุน",
  allocation: "สัดส่วนพอร์ต",
};

const SERIES_COLORS = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#db2777",
];

// Distinct colour per slice: hue steps by the golden angle so neighbours never
// look alike and no colour repeats however many funds there are.
function sliceColor(i: number) {
  return `hsl(${Math.round((i * 137.508) % 360)}, 65%, ${i % 2 === 0 ? 50 : 62}%)`;
}

function numberTick(v: number) {
  return v.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

// Tightly wraps the actual rendered value range (3% padding) instead of the
// default 0-anchored axis, which otherwise leaves most of the chart as dead
// space when the series only fluctuates within a narrow band far from zero.
const TIGHT_DOMAIN: [(min: number) => number, (max: number) => number] = [
  (min) => Math.floor(min * 0.97),
  (max) => Math.ceil(max * 1.03),
];

type ProfitSeriesMode = "both" | "month" | "allTime";

const PROFIT_SERIES_LABELS: Record<ProfitSeriesMode, string> = {
  both: "เทียบทั้งสอง",
  month: "ไม่เทรดรายเดือน",
  allTime: "ไม่เทรดตั้งแต่ต้น",
};

const DASHBOARD_PERIODS: Period[] = ["1m", "3m", "6m", "all"];

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="py-10 text-center text-sm text-black/50 dark:text-white/50">
      {children}
    </p>
  );
}

/** Legend in the same order as the slices (= dashboard order), colour-matched, with each share. */
function AllocationLegend({
  items,
}: {
  /** With `cost`, each row also shows its value and gain/loss (category mode). */
  items: { name: string; value: number; cost?: number }[];
}) {
  const total = items.reduce((sum, x) => sum + x.value, 0);
  if (total <= 0) return null;
  const detailed = items.some((x) => x.cost !== undefined);
  return (
    <ul
      className={`grid grid-cols-1 gap-x-6 gap-y-1 text-sm ${detailed ? "" : "sm:grid-cols-2"}`}
    >
      {items.map((x, i) => {
        const pnl = x.cost !== undefined ? x.value - x.cost : null;
        return (
          <li key={x.name} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: sliceColor(i) }}
            />
            <span className="truncate">{x.name}</span>
            <span className="ml-auto flex shrink-0 items-baseline gap-3 tabular-nums">
              {x.cost !== undefined && <span>{formatMoney(x.value)}</span>}
              {pnl !== null && (
                <span className={`text-xs ${pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {pnl >= 0 ? "+" : ""}
                  {formatMoney(pnl)}
                </span>
              )}
              <span className="w-12 text-right text-black/60 dark:text-white/60">
                {((x.value / total) * 100).toFixed(1)}%
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default function DashboardCharts({
  currency,
  assets,
  snapshots,
  fundLog,
  transactions,
  live,
  categoryBreakdown,
  fundBreakdown,
}: {
  currency: Currency;
  assets: Asset[];
  snapshots: Snapshot[];
  fundLog: FundLogEntry[];
  transactions: Transaction[];
  /**
   * The dashboard's own live totals (current prices). Snapshots only move when
   * a snapshot is saved, so the charts' final point is pinned to this value
   * to keep the headline total and the chart in agreement.
   */
  live: { date: string; value: number; cost: number };
  categoryBreakdown: { category: string; value: number; cost: number }[];
  fundBreakdown: { name: string; value: number }[];
}) {
  const [view, setView] = useState<View>("total");

  const currencyAssets = useMemo(
    () => assets.filter((a) => a.currency === currency),
    [assets, currency]
  );

  const snapshotPoints = useMemo(
    () =>
      snapshots
        .filter((s) => s.currency === currency)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((s) => ({
          date: s.date,
          totalValue: s.totalValue,
          totalCost: s.totalCost,
        })),
    [snapshots, currency]
  );
  const totalPoints = useMemo(() => {
    if (snapshotPoints.length === 0) return snapshotPoints;
    const livePoint = { date: live.date, totalValue: live.value, totalCost: live.cost };
    const last = snapshotPoints[snapshotPoints.length - 1];
    return last.date >= live.date
      ? [...snapshotPoints.slice(0, -1), { ...livePoint, date: last.date }]
      : [...snapshotPoints, livePoint];
  }, [snapshotPoints, live]);

  const categorySeries = useMemo(() => {
    const base = buildCategorySeries(snapshots, currency);
    if (base.points.length === 0) return base;
    const livePoint: CategorySeriesPoint = { date: live.date };
    for (const c of categoryBreakdown) livePoint[c.category] = c.value;
    const last = base.points[base.points.length - 1];
    const points =
      last.date >= live.date
        ? [...base.points.slice(0, -1), { ...livePoint, date: last.date }]
        : [...base.points, livePoint];
    const categories = [...new Set([...base.categories, ...categoryBreakdown.map((c) => c.category)])].sort();
    return { points, categories };
  }, [snapshots, currency, live, categoryBreakdown]);
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  function toggleCategory(cat: string) {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [allocationMode, setAllocationMode] = useState<"category" | "fund">("category");

  const [profitMode, setProfitMode] = useState<ProfitSeriesMode>("both");
  const showProfitMonth = profitMode !== "allTime";
  const showProfitAllTime = profitMode !== "month";

  const [period, setPeriod] = useState<Period>("all");
  const cutoff = useMemo(() => cutoffDateFor(period), [period]);

  const noTradeSeriesFull = useMemo(
    () => computeNoTradeSeries(fundLog, snapshots, transactions, assets, currency),
    [fundLog, snapshots, transactions, assets, currency]
  );
  const noTradeSeries = useMemo(
    () => (cutoff ? noTradeSeriesFull.filter((p) => p.date >= cutoff) : noTradeSeriesFull),
    [noTradeSeriesFull, cutoff]
  );

  const totalTicks = useMemo(
    () => pickEvenTicks(totalPoints.map((p) => p.date)),
    [totalPoints]
  );
  const categoryTicks = useMemo(
    () => pickEvenTicks(categorySeries.points.map((p) => p.date)),
    [categorySeries]
  );
  const noTradeTicks = useMemo(
    () => pickEvenTicks(noTradeSeries.map((p) => p.date)),
    [noTradeSeries]
  );

  const profitSeries = useMemo(
    () =>
      noTradeSeries.map((p) => ({
        date: p.date,
        profitVsNoTradeMonth: p.noTradeMonth == null ? null : p.actual - p.noTradeMonth,
        profitVsNoTradeAllTime:
          p.noTradeAllTime == null ? null : p.actual - p.noTradeAllTime,
      })),
    [noTradeSeries]
  );
  const profitTicks = useMemo(
    () => pickEvenTicks(profitSeries.map((p) => p.date)),
    [profitSeries]
  );
  const profitDomain = useMemo(() => {
    const values = profitSeries
      .flatMap((p) => [
        showProfitMonth ? p.profitVsNoTradeMonth : null,
        showProfitAllTime ? p.profitVsNoTradeAllTime : null,
      ])
      .filter((v): v is number => v != null);
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    const pad = Math.max((max - min) * 0.1, 1);
    return { min: min - pad, max: max + pad };
  }, [profitSeries, showProfitMonth, showProfitAllTime]);

  return (
    <div className="space-y-4 rounded-lg border border-black/10 p-4 dark:border-white/10">
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(VIEW_LABELS) as View[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              view === v
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "bg-black/5 text-black/60 hover:bg-black/10 dark:bg-white/10 dark:text-white/60 dark:hover:bg-white/20"
            }`}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}
      </div>

      {(view === "notrade" || view === "profit") && (
        <div className="flex flex-wrap gap-1.5">
          {DASHBOARD_PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-full border px-2.5 py-1 text-xs ${
                period === p
                  ? "border-black/20 font-medium dark:border-white/30"
                  : "border-black/10 text-black/40 dark:border-white/10 dark:text-white/40"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      )}

      {view === "total" &&
        (totalPoints.length === 0 ? (
          <EmptyNote>
            ยังไม่มีประวัติมูลค่าพอร์ต กด &quot;บันทึกราคา&quot; ในหน้าอัปเดตราคาเพื่อเริ่มเก็บข้อมูล
          </EmptyNote>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={totalPoints} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                <XAxis
                  dataKey="date"
                  ticks={totalTicks}
                  fontSize={12}
                  stroke="currentColor"
                  opacity={0.6}
                  tickFormatter={formatDate}
                />
                <YAxis
                  domain={TIGHT_DOMAIN}
                  allowDataOverflow
                  fontSize={12}
                  stroke="currentColor"
                  opacity={0.6}
                  width={70}
                  tickFormatter={numberTick}
                />
                <Tooltip
                  labelFormatter={(label) => formatDate(String(label))}
                  formatter={(value) =>
                    typeof value === "number"
                      ? value.toLocaleString("th-TH", { maximumFractionDigits: 2 })
                      : value
                  }
                />
                <Legend />
                <Line type="monotone" dataKey="totalValue" name="มูลค่าพอร์ตรวม" stroke="#2563eb" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="totalCost" name="ทุนรวม" stroke="#dc2626" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}

      {view === "category" &&
        (categorySeries.points.length === 0 ? (
          <EmptyNote>ยังไม่มีประวัติแยกตามพอร์ต</EmptyNote>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {categorySeries.categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    hiddenCategories.has(cat)
                      ? "border-black/10 text-black/40 dark:border-white/10 dark:text-white/40"
                      : "border-black/20 font-medium dark:border-white/30"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={categorySeries.points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                  <XAxis dataKey="date" ticks={categoryTicks} fontSize={12} stroke="currentColor" opacity={0.6} tickFormatter={formatDate} />
                  <YAxis fontSize={12} stroke="currentColor" opacity={0.6} width={70} tickFormatter={numberTick} />
                  <Tooltip
                    labelFormatter={(label) => formatDate(String(label))}
                    formatter={(value) =>
                      typeof value === "number"
                        ? value.toLocaleString("th-TH", { maximumFractionDigits: 2 })
                        : value
                    }
                  />
                  <Legend />
                  {categorySeries.categories
                    .filter((cat) => !hiddenCategories.has(cat))
                    .map((cat, i) => (
                      <Line
                        key={cat}
                        type="monotone"
                        dataKey={cat}
                        name={cat}
                        stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        ))}

      {view === "fund" && (
        <>
          <select
            value={selectedAssetId}
            onChange={(e) => setSelectedAssetId(e.target.value)}
            className="rounded-md border border-black/15 px-3 py-1.5 text-sm dark:border-white/20 dark:bg-transparent"
          >
            <option value="">เลือกกองทุน/หุ้น...</option>
            {currencyAssets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          <FundValueChart assetId={selectedAssetId} fundLog={fundLog} />
        </>
      )}

      {view === "profit" && (
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(PROFIT_SERIES_LABELS) as ProfitSeriesMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setProfitMode(m)}
              className={`rounded-full border px-2.5 py-1 text-xs ${
                profitMode === m
                  ? "border-black/20 font-medium dark:border-white/30"
                  : "border-black/10 text-black/40 dark:border-white/10 dark:text-white/40"
              }`}
            >
              {PROFIT_SERIES_LABELS[m]}
            </button>
          ))}
        </div>
      )}

      {view === "notrade" &&
        (noTradeSeries.length === 0 ? (
          <EmptyNote>ยังไม่มีข้อมูลพอที่จะเปรียบเทียบเทรดกับไม่เทรด</EmptyNote>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={noTradeSeries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                <XAxis dataKey="date" ticks={noTradeTicks} fontSize={12} stroke="currentColor" opacity={0.6} tickFormatter={formatDate} />
                <YAxis domain={TIGHT_DOMAIN} allowDataOverflow fontSize={12} stroke="currentColor" opacity={0.6} width={70} tickFormatter={numberTick} />
                <Tooltip
                  labelFormatter={(label) => formatDate(String(label))}
                  formatter={(value) =>
                    typeof value === "number"
                      ? value.toLocaleString("th-TH", { maximumFractionDigits: 2 })
                      : value
                  }
                />
                <Legend />
                <Line type="monotone" dataKey="actual" name="พอร์ตจริง (เทรด)" stroke="#2563eb" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="noTradeMonth" name="ถ้าไม่เทรด (รายเดือน)" stroke="#d97706" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="noTradeAllTime" name="ถ้าไม่เทรด (ตั้งแต่ต้น)" stroke="#7c3aed" strokeWidth={2} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}

      {view === "profit" &&
        (profitSeries.length === 0 ? (
          <EmptyNote>ยังไม่มีข้อมูลพอที่จะคำนวณกำไร</EmptyNote>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={profitSeries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                <XAxis dataKey="date" ticks={profitTicks} fontSize={12} stroke="currentColor" opacity={0.6} tickFormatter={formatDate} />
                <YAxis
                  domain={[profitDomain.min, profitDomain.max]}
                  allowDataOverflow
                  fontSize={12}
                  stroke="currentColor"
                  opacity={0.6}
                  width={70}
                  tickFormatter={numberTick}
                />
                <ReferenceArea y1={0} y2={profitDomain.max} fill="#16a34a" fillOpacity={0.08} ifOverflow="visible" />
                <ReferenceArea y1={profitDomain.min} y2={0} fill="#dc2626" fillOpacity={0.08} ifOverflow="visible" />
                <ReferenceLine y={0} stroke="currentColor" opacity={0.35} />
                <Tooltip
                  labelFormatter={(label) => formatDate(String(label))}
                  formatter={(value) =>
                    typeof value === "number"
                      ? value.toLocaleString("th-TH", { maximumFractionDigits: 2 })
                      : value
                  }
                />
                <Legend />
                {showProfitMonth && (
                  <Line type="monotone" dataKey="profitVsNoTradeMonth" name="เทียบพอร์ตถ้าไม่เทรด (รายเดือน)" stroke="#d97706" strokeWidth={2} dot={false} connectNulls />
                )}
                {showProfitAllTime && (
                  <Line type="monotone" dataKey="profitVsNoTradeAllTime" name="เทียบพอร์ตถ้าไม่เทรด (ตั้งแต่ต้น)" stroke="#7c3aed" strokeWidth={2} dot={false} connectNulls />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}

      {view === "profitVsCost" &&
        (totalPoints.length === 0 ? (
          <EmptyNote>ยังไม่มีประวัติมูลค่าพอร์ต</EmptyNote>
        ) : (
          <ProfitVsCostChart
            points={totalPoints.map((p) => ({
              date: p.date,
              profit: p.totalValue - p.totalCost,
            }))}
          />
        ))}

      {view === "allocation" && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["category", "ตามหมวด"],
                ["fund", "ตามกองทุน"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setAllocationMode(mode)}
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  allocationMode === mode
                    ? "border-black/20 font-medium dark:border-white/30"
                    : "border-black/10 text-black/40 dark:border-white/10 dark:text-white/40"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {(allocationMode === "category" ? categoryBreakdown : fundBreakdown).length ===
          0 ? (
            <EmptyNote>ยังไม่มีสินทรัพย์ในพอร์ต</EmptyNote>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocationMode === "category" ? categoryBreakdown : fundBreakdown}
                    dataKey="value"
                    nameKey={allocationMode === "category" ? "category" : "name"}
                    innerRadius="45%"
                    outerRadius="80%"
                    paddingAngle={2}
                  >
                    {(allocationMode === "category" ? categoryBreakdown : fundBreakdown).map(
                      (entry, i) => (
                        <Cell
                          key={"category" in entry ? entry.category : entry.name}
                          fill={sliceColor(i)}
                        />
                      )
                    )}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [
                      typeof value === "number" ? formatMoney(value) : value,
                      name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <AllocationLegend
            items={(allocationMode === "category" ? categoryBreakdown : fundBreakdown).map((e) => ({
              name: "category" in e ? e.category : e.name,
              value: e.value,
              cost: "cost" in e ? e.cost : undefined,
            }))}
          />
        </>
      )}
    </div>
  );
}
