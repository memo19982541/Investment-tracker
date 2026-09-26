"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { computeRealizedPnlEvents, snapshotStatsAtDate } from "@/lib/analytics";
import { formatDate, formatMoney, pickEvenTicks } from "@/lib/format";
import { cutoffDateFor, PERIOD_LABELS, type Period } from "@/lib/period";
import type { Asset, Currency, Holding, Snapshot, Transaction } from "@/lib/types";

const ANALYSIS_PERIODS: Period[] = ["1m", "3m", "6m", "1y"];

function numberTick(v: number) {
  return v.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

function PnlText({ value, pct }: { value: number; pct?: number }) {
  return (
    <span className={value >= 0 ? "text-green-600" : "text-red-600"}>
      {value >= 0 ? "+" : ""}
      {formatMoney(value)}
      {pct !== undefined && ` (${value >= 0 ? "+" : ""}${pct.toFixed(1)}%)`}
    </span>
  );
}

export default function AnalysisSection({
  currency,
  assets,
  transactions,
  snapshots,
  holdings,
}: {
  currency: Currency;
  assets: Asset[];
  transactions: Transaction[];
  snapshots: Snapshot[];
  holdings: Holding[];
}) {
  const [period, setPeriod] = useState<Period>("3m");

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const currencySnapshots = useMemo(
    () =>
      snapshots
        .filter((s) => s.currency === currency)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [snapshots, currency]
  );
  const earliestDate = currencySnapshots[0]?.date;

  const requestedCutoff = cutoffDateFor(period);
  const periodStart =
    requestedCutoff && earliestDate && requestedCutoff < earliestDate
      ? earliestDate
      : requestedCutoff;
  const wasClamped = !!(periodStart && requestedCutoff && periodStart > requestedCutoff);

  const statsStart = periodStart ? snapshotStatsAtDate(snapshots, currency, periodStart) : null;
  const statsNow = snapshotStatsAtDate(snapshots, currency, today);
  const pnlStart = statsStart ? statsStart.totalValue - statsStart.totalCost : null;
  const pnlNow = statsNow ? statsNow.totalValue - statsNow.totalCost : null;

  const realizedEvents = useMemo(() => {
    // Cash "sells" are withdrawals/internal transfers, not investing
    // decisions — they always realize ~0 pnl (cost=value=amount for cash)
    // and would just clutter the sales report.
    const tradableAssetIds = new Set(
      assets.filter((a) => a.type !== "cash").map((a) => a.id)
    );
    return computeRealizedPnlEvents(transactions, assets, currency)
      .filter(
        (e) =>
          tradableAssetIds.has(e.assetId) &&
          (!periodStart || e.date > periodStart) &&
          e.date <= today
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, assets, currency, periodStart, today]);
  const realizedTotal = realizedEvents.reduce((s, e) => s + e.pnl, 0);
  const unrealizedChange = pnlNow != null && pnlStart != null ? pnlNow - pnlStart : null;
  const totalPeriodPnl =
    unrealizedChange != null ? realizedTotal + unrealizedChange : null;
  // % against the portfolio's value at the start of the period — the
  // capital base that produced this return. Deposit-neutral like the P&L
  // figure itself, though a large deposit mid-period will understate the
  // % somewhat since the base grew partway through.
  const totalPeriodPnlPct =
    totalPeriodPnl != null && statsStart && statsStart.totalValue > 0
      ? (totalPeriodPnl / statsStart.totalValue) * 100
      : undefined;

  const chartPoints = useMemo(
    () =>
      currencySnapshots
        .filter((s) => !periodStart || s.date >= periodStart)
        .map((s) => ({ date: s.date, totalValue: s.totalValue, totalCost: s.totalCost })),
    [currencySnapshots, periodStart]
  );
  const chartTicks = useMemo(() => pickEvenTicks(chartPoints.map((p) => p.date)), [chartPoints]);

  const sortedHoldings = useMemo(
    () => [...holdings].sort((a, b) => b.pnl - a.pnl),
    [holdings]
  );
  const barData = sortedHoldings.map((h) => ({ name: h.asset.name, pnl: h.pnl }));

  const assetName = (id: string) => assets.find((a) => a.id === id)?.name ?? id;

  if (!periodStart || pnlStart == null || pnlNow == null) {
    return (
      <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {ANALYSIS_PERIODS.map((p) => (
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
        <p className="py-10 text-center text-sm text-black/50 dark:text-white/50">
          ยังไม่มีข้อมูลพอที่จะวิเคราะห์ในช่วงเวลานี้
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5">
        {ANALYSIS_PERIODS.map((p) => (
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
      {wasClamped && (
        <p className="text-xs text-black/50 dark:text-white/50">
          มีข้อมูลย้อนหลังถึงแค่ {formatDate(periodStart)} เท่านั้น จึงคำนวณจากวันดังกล่าวแทน
        </p>
      )}

      <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
        <p className="text-sm text-black/60 dark:text-white/60">
          กำไร/ขาดทุนรวมในช่วง {PERIOD_LABELS[period]}
        </p>
        <p className="text-3xl font-bold">
          {totalPeriodPnl != null ? (
            <PnlText value={totalPeriodPnl} pct={totalPeriodPnlPct} />
          ) : (
            "-"
          )}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-black/60 dark:text-white/60">
          <span>
            รับรู้แล้ว (จากการขาย): <PnlText value={realizedTotal} />
          </span>
          <span>
            ยังไม่รับรู้ (เปลี่ยนแปลงในช่วงนี้):{" "}
            {unrealizedChange != null ? <PnlText value={unrealizedChange} /> : "-"}
          </span>
        </div>
      </div>

      {chartPoints.length > 0 && (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartPoints} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
              <XAxis dataKey="date" ticks={chartTicks} fontSize={12} stroke="currentColor" opacity={0.6} tickFormatter={formatDate} />
              <YAxis fontSize={12} stroke="currentColor" opacity={0.6} width={70} tickFormatter={numberTick} />
              <Tooltip
                labelFormatter={(label) => formatDate(String(label))}
                formatter={(value) =>
                  typeof value === "number"
                    ? value.toLocaleString("th-TH", { maximumFractionDigits: 2 })
                    : value
                }
              />
              <Line type="monotone" dataKey="totalValue" name="มูลค่าพอร์ต" stroke="#2563eb" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="totalCost" name="ทุน" stroke="#dc2626" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold">การขายทำกำไร/ขาดทุนในช่วงนี้</h3>
        {realizedEvents.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">ไม่มีการขายในช่วงนี้</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/10 text-left text-black/60 dark:border-white/10 dark:text-white/60">
                  <th className="py-2 pr-4">วันที่</th>
                  <th className="py-2 pr-4">สินทรัพย์</th>
                  <th className="py-2 pr-4 text-right">จำนวนหน่วย</th>
                  <th className="py-2 pr-4 text-right">มูลค่าขาย</th>
                  <th className="py-2 pr-4 text-right">ทุน</th>
                  <th className="py-2 pr-4 text-right">กำไร/ขาดทุน</th>
                </tr>
              </thead>
              <tbody>
                {realizedEvents.map((e, i) => (
                  <tr key={i} className="border-b border-black/5 dark:border-white/5">
                    <td className="py-2 pr-4">{formatDate(e.date)}</td>
                    <td className="py-2 pr-4">{assetName(e.assetId)}</td>
                    <td className="py-2 pr-4 text-right">{e.units.toLocaleString("th-TH", { maximumFractionDigits: 4 })}</td>
                    <td className="py-2 pr-4 text-right">{formatMoney(e.proceeds)}</td>
                    <td className="py-2 pr-4 text-right">{formatMoney(e.costBasis)}</td>
                    <td className="py-2 pr-4 text-right">
                      <PnlText value={e.pnl} pct={e.costBasis > 0 ? (e.pnl / e.costBasis) * 100 : undefined} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">กำไร/ขาดทุนที่ยังไม่รับรู้ (กองทุนที่ถืออยู่ตอนนี้)</h3>
        {sortedHoldings.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">ไม่มีสินทรัพย์ที่ถืออยู่</p>
        ) : (
          <>
            <div className="mb-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} horizontal={false} />
                  <XAxis type="number" fontSize={12} stroke="currentColor" opacity={0.6} tickFormatter={numberTick} />
                  <YAxis type="category" dataKey="name" fontSize={11} stroke="currentColor" opacity={0.6} width={90} />
                  <ReferenceLine x={0} stroke="currentColor" opacity={0.35} />
                  <Tooltip formatter={(value) => (typeof value === "number" ? formatMoney(value) : value)} />
                  <Bar dataKey="pnl" name="กำไร/ขาดทุน">
                    {barData.map((d) => (
                      <Cell key={d.name} fill={d.pnl >= 0 ? "#16a34a" : "#dc2626"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-left text-black/60 dark:border-white/10 dark:text-white/60">
                    <th className="py-2 pr-4">ชื่อ</th>
                    <th className="py-2 pr-4">หมวด</th>
                    <th className="py-2 pr-4 text-right">ทุน</th>
                    <th className="py-2 pr-4 text-right">มูลค่าปัจจุบัน</th>
                    <th className="py-2 pr-4 text-right">กำไร/ขาดทุน</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedHoldings.map((h) => (
                    <tr key={h.asset.id} className="border-b border-black/5 dark:border-white/5">
                      <td className="py-2 pr-4">{h.asset.name}</td>
                      <td className="py-2 pr-4">{h.asset.category}</td>
                      <td className="py-2 pr-4 text-right">{formatMoney(h.cost)}</td>
                      <td className="py-2 pr-4 text-right">{formatMoney(h.currentValue)}</td>
                      <td className="py-2 pr-4 text-right">
                        <PnlText value={h.pnl} pct={h.pnlPct} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
