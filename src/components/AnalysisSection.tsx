"use client";

import { useMemo, useState } from "react";
import {
  computePeriodCapitalBase,
  computeRealizedPnlEvents,
  snapshotStatsAtDate,
} from "@/lib/analytics";
import { formatDate, formatMoney, todayInThailand } from "@/lib/format";
import { cutoffDateFor, PERIOD_LABELS, type Period } from "@/lib/period";
import type { Asset, Currency, Holding, Snapshot, Transaction } from "@/lib/types";

const ANALYSIS_PERIODS: Period[] = ["1m", "3m", "6m", "1y"];

const CURRENCY_SYMBOL: Record<Currency, string> = { THB: "฿", USD: "$" };

interface BarSegment {
  label: string;
  value: number;
  color: string;
}

function money0(v: number) {
  return v.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

/** One stacked horizontal bar with a legend. Negative values get no width. */
function StackedBar({
  title,
  total,
  segments,
  scale,
  symbol,
}: {
  title: string;
  total: number;
  segments: BarSegment[];
  scale: number;
  symbol: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-sm text-black/60 dark:text-white/60">{title}</span>
        <span className="text-lg font-semibold">
          {symbol}
          {money0(total)}
        </span>
      </div>
      <div className="flex h-8 w-full gap-0.5 overflow-hidden rounded-lg bg-black/5 dark:bg-white/5">
        {segments.map((seg) => (
          <div
            key={seg.label}
            style={{
              width: `${scale > 0 ? (Math.max(seg.value, 0) / scale) * 100 : 0}%`,
              backgroundColor: seg.color,
            }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-black/70 dark:text-white/70">
        {segments.map((seg) => (
          <span key={seg.label} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: seg.color }} />
            {seg.label} {seg.value < 0 ? "-" : ""}
            {symbol}
            {money0(Math.abs(seg.value))}
          </span>
        ))}
      </div>
    </div>
  );
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
  const [period, setPeriod] = useState<Period>("1m");

  const today = useMemo(() => todayInThailand(), []);

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
  // % against the start value plus time-weighted deposits, so money added
  // mid-period doesn't inflate the return (the P&L itself already excludes it).
  // Falls back to the plain start value when there aren't two snapshots to
  // read the flows from.
  const capital = periodStart
    ? computePeriodCapitalBase(snapshots, transactions, assets, currency, periodStart, today)
    : null;
  const pctBase = capital?.base ?? statsStart?.totalValue ?? 0;
  const totalPeriodPnlPct =
    totalPeriodPnl != null && pctBase > 0 ? (totalPeriodPnl / pctBase) * 100 : undefined;

  // Where the portfolio's cost and value come from over the period. Selling
  // moves cost between an asset and cash by exactly the realized gain, so the
  // net money added (deposits minus withdrawals) is what's left of the cost
  // change after taking realized gains out. Both bars then add up exactly:
  //   cost  now = cost  at start + net deposits + realized
  //   value now = value at start + net deposits + realized + unrealized change
  const symbol = CURRENCY_SYMBOL[currency];
  const cashValue = holdings
    .filter((h) => h.asset.type === "cash")
    .reduce((s, h) => s + h.currentValue, 0);
  const netDeposits =
    statsNow && statsStart ? statsNow.totalCost - statsStart.totalCost - realizedTotal : 0;
  const costSegments: BarSegment[] = [
    { label: "ต้นทุนต้นช่วง", value: statsStart?.totalCost ?? 0, color: "#5b8def" },
    { label: "เงินเติมสุทธิ", value: netDeposits, color: "#f2b45a" },
    { label: "Realized", value: realizedTotal, color: "#34c790" },
  ];
  const valueSegments: BarSegment[] = [
    { label: "มูลค่าต้นช่วง", value: statsStart?.totalValue ?? 0, color: "#5b8def" },
    { label: "เงินเติมสุทธิ", value: netDeposits, color: "#f2b45a" },
    { label: "Realized", value: realizedTotal, color: "#34c790" },
    { label: "Unrealized เปลี่ยน", value: unrealizedChange ?? 0, color: "#ee6a6a" },
  ];
  const positive = (segs: BarSegment[]) => segs.reduce((s, x) => s + Math.max(x.value, 0), 0);
  const barScale = Math.max(positive(costSegments), positive(valueSegments));

  const sortedHoldings = useMemo(
    () => [...holdings].sort((a, b) => b.pnl - a.pnl),
    [holdings]
  );

  const assetName = (id: string) => assets.find((a) => a.id === id)?.name ?? id;

  if (!periodStart || !statsStart || !statsNow || pnlStart == null || pnlNow == null) {
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
        {pctBase > 0 && (
          <p className="mt-2 text-xs text-black/50 dark:text-white/50">
            % คิดจากเงินทุนเฉลี่ย {symbol}
            {money0(pctBase)} (มูลค่าต้นช่วง + เงินเติมที่ถ่วงตามเวลาที่อยู่ในพอร์ต) ไม่นับเงินเติมเป็นกำไร
          </p>
        )}
      </div>

      <div className="space-y-6 rounded-2xl border border-black/10 p-5 dark:border-white/10">
        <div>
          <h3 className="text-base font-semibold">มูลค่าเงินลงทุนเทียบมูลค่าปัจจุบัน</h3>
          <p className="text-sm text-black/50 dark:text-white/50">
            พอร์ตรวม · รวมเงินสด · ช่วง {PERIOD_LABELS[period]}
          </p>
        </div>
        <StackedBar
          title="ต้นทุนสะสม"
          total={statsNow.totalCost}
          segments={costSegments}
          scale={barScale}
          symbol={symbol}
        />
        <StackedBar
          title="มูลค่าปัจจุบัน"
          total={statsNow.totalValue}
          segments={valueSegments}
          scale={barScale}
          symbol={symbol}
        />
        <p className="text-xs text-black/50 dark:text-white/50">
          เงินเติมสุทธิ = เงินฝาก − เงินถอน ประมาณจากต้นทุนที่เปลี่ยนไปหักกำไรที่ขายแล้ว · ตอนนี้มีเงินสดอยู่ใน
          พอร์ต {symbol}
          {money0(cashValue)} (รวมอยู่ในตัวเลขข้างบนแล้ว)
        </p>
      </div>

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
