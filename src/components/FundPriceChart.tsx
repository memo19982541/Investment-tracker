"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getFundPriceHistory } from "@/app/dashboardActions";
import { backfillFundHistory } from "@/app/prices/actions";
import { buildFundSeries, buildTradeMarkers } from "@/lib/analytics";
import { formatDate, pickEvenTicks } from "@/lib/format";
import type { FundNavPoint } from "@/lib/priceSource";
import type { FundLogEntry, Transaction } from "@/lib/types";

function numberTick(v: number) {
  return v.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

/**
 * A fund's NAV/price line with buy/sell transaction markers overlaid —
 * replicates the reference sheet's per-fund chart ("กองทุนแม่" comparison).
 * Prefers live NAV history scraped from settrade.com (rich, long history);
 * falls back to our own accumulated fundLog when that's unavailable.
 */
export default function FundPriceChart({
  assetId,
  fundLog,
  transactions,
}: {
  assetId: string;
  fundLog: FundLogEntry[];
  transactions: Transaction[];
}) {
  const [fundHistory, setFundHistory] = useState<{
    assetId: string;
    points: FundNavPoint[];
  } | null>(null);
  const [isLoading, startTransition] = useTransition();

  useEffect(() => {
    if (!assetId) return;
    startTransition(async () => {
      const points = await getFundPriceHistory(assetId);
      setFundHistory({ assetId, points });
    });
  }, [assetId]);

  const historyPoints = useMemo(
    () => (fundHistory?.assetId === assetId ? fundHistory.points : []),
    [fundHistory, assetId]
  );

  const chart = useMemo(() => {
    if (!assetId) return null;
    const scraped = historyPoints.map((p) => ({ date: p.navDate, price: p.price }));
    const fallback = buildFundSeries(fundLog, assetId).map((p) => ({
      date: p.date,
      price: p.price,
    }));
    const priceSeries = scraped.length > 0 ? scraped : fallback;
    const priceByDate = new Map(priceSeries.map((p) => [p.date, p.price]));

    // Buy/sell markers are folded into the same `data` array (as extra
    // fields) rather than given to <Scatter> as their own separate array:
    // Recharts positions a category-axis Scatter by matching index order
    // against the chart's own `data`, not by matching date values, so a
    // separately-filtered array renders at the wrong x position.
    const markers = buildTradeMarkers(transactions, assetId);
    const buyByDate = new Map(
      markers.filter((m) => m.type === "buy").map((m) => [m.date, m.price])
    );
    const sellByDate = new Map(
      markers.filter((m) => m.type === "sell").map((m) => [m.date, m.price])
    );

    const allDates = [
      ...new Set([...priceSeries.map((p) => p.date), ...markers.map((m) => m.date)]),
    ].sort();
    const data = allDates.map((date) => ({
      date,
      price: priceByDate.get(date) ?? null,
      buyPrice: buyByDate.get(date) ?? null,
      sellPrice: sellByDate.get(date) ?? null,
    }));

    return {
      data,
      hasBuy: buyByDate.size > 0,
      hasSell: sellByDate.size > 0,
      hasPrice: priceSeries.length > 0,
    };
  }, [assetId, historyPoints, fundLog, transactions]);

  const emptyClass = "py-10 text-center text-sm text-black/50 dark:text-white/50";

  if (!assetId) return <p className={emptyClass}>เลือกกองทุนเพื่อดูกราฟราคาและจุดซื้อ/ขาย</p>;
  if (isLoading) return <p className={emptyClass}>กำลังโหลดราคาย้อนหลัง...</p>;
  if (!chart || !chart.hasPrice)
    return <p className={emptyClass}>ไม่มีข้อมูลราคาย้อนหลังสำหรับสินทรัพย์นี้</p>;

  return (
    <div className="space-y-2">
      <BackfillButton assetId={assetId} />
      <FundChartCanvas data={chart.data} hasBuy={chart.hasBuy} hasSell={chart.hasSell} />
    </div>
  );
}

/**
 * One-off action to save the scraped NAV history above into `fundLog`
 * permanently — the chart above is ephemeral (re-fetched on every view), so
 * without this a fund's no-trade baseline still has no data before today.
 */
function BackfillButton({ assetId }: { assetId: string }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function handleClick() {
    startTransition(async () => {
      const r = await backfillFundHistory(assetId);
      if (r.fetched === 0) {
        setResult("ไม่พบราคาย้อนหลังสำหรับกองทุนนี้");
        return;
      }
      const mismatchNote =
        r.mismatched.length > 0
          ? ` — พบ ${r.mismatched.length} วันที่หน่วยไม่ตรงกับธุรกรรมที่บันทึกไว้ (ไม่ได้แก้ให้อัตโนมัติ ตรวจสอบเอง): ${r.mismatched.join(", ")}`
          : "";
      setResult(
        `บันทึกเพิ่ม ${r.added} วัน (มีอยู่แล้ว ${r.skipped} วัน จากทั้งหมด ${r.fetched} วัน)${mismatchNote}`
      );
    });
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-full border border-black/20 px-2.5 py-1 dark:border-white/30 disabled:opacity-50"
      >
        {isPending ? "กำลังบันทึก..." : "บันทึกราคาย้อนหลังเข้าระบบ"}
      </button>
      {result && <span className="text-black/60 dark:text-white/60">{result}</span>}
    </div>
  );
}

const PX_PER_POINT = 8;

function FundChartCanvas({
  data,
  hasBuy,
  hasSell,
}: {
  data: { date: string; price: number | null; buyPrice: number | null; sellPrice: number | null }[];
  hasBuy: boolean;
  hasSell: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const wideWidth = Math.max(600, data.length * PX_PER_POINT);
  const tickValues = useMemo(
    () => pickEvenTicks(data.map((d) => d.date), expanded ? 14 : 6),
    [data, expanded]
  );

  const chartEl = (
    <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
      <XAxis
        dataKey="date"
        ticks={tickValues}
        fontSize={12}
        stroke="currentColor"
        opacity={0.6}
        tickFormatter={formatDate}
      />
      <YAxis
        fontSize={12}
        stroke="currentColor"
        opacity={0.6}
        width={60}
        domain={["auto", "auto"]}
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
      <Line type="monotone" dataKey="price" name="NAV/ราคา (กองทุนแม่)" stroke="#2563eb" strokeWidth={2} dot={false} connectNulls />
      {hasBuy && <Scatter data={data} dataKey="buyPrice" name="ซื้อ" fill="#16a34a" shape="triangle" />}
      {hasSell && <Scatter data={data} dataKey="sellPrice" name="ขาย" fill="#dc2626" shape="diamond" />}
    </ComposedChart>
  );

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="rounded-full border border-black/20 px-2.5 py-1 text-xs dark:border-white/30"
        >
          {expanded ? "ย่อกลับ" : "ขยายแนวนอน"}
        </button>
      </div>
      {expanded ? (
        <div className="h-72 w-full overflow-x-auto">
          <div style={{ width: `${wideWidth}px`, height: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              {chartEl}
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartEl}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
