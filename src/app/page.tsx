import Link from "next/link";
import { requireContext } from "@/lib/session";
import {
  computeHoldings,
  getAssets,
  getFundLog,
  getPrices,
  getSnapshots,
  getTransactions,
  sortAssetsForDisplay,
} from "@/lib/data";
import { formatMoney, formatUnits } from "@/lib/format";
import DashboardCharts from "@/components/DashboardCharts";
import ReorderButtons from "@/components/ReorderButtons";
import TargetPctInput from "@/components/TargetPctInput";
import type {
  Asset,
  Currency,
  FundLogEntry,
  Holding,
  Snapshot,
  Transaction,
} from "@/lib/types";

const CURRENCY_LABEL: Record<Currency, string> = {
  THB: "พอร์ตบาท (THB)",
  USD: "พอร์ตดอลลาร์ (USD)",
};

function CurrencySection({
  currency,
  holdings,
  assets,
  snapshots,
  fundLog,
  transactions,
}: {
  currency: Currency;
  holdings: Holding[];
  assets: Asset[];
  snapshots: Snapshot[];
  fundLog: FundLogEntry[];
  transactions: Transaction[];
}) {
  const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0);
  const totalCost = holdings.reduce((s, h) => s + h.cost, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const cashTotal = holdings
    .filter((h) => h.asset.type === "cash")
    .reduce((s, h) => s + h.currentValue, 0);

  const byCategory = new Map<string, { value: number; cost: number }>();
  for (const h of holdings) {
    const cur = byCategory.get(h.asset.category) ?? { value: 0, cost: 0 };
    cur.value += h.currentValue;
    cur.cost += h.cost;
    byCategory.set(h.asset.category, cur);
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-black/60 dark:text-white/60">
          {CURRENCY_LABEL[currency]}
        </p>
        <p className="text-4xl font-bold">{formatMoney(totalValue)}</p>
        <p className={totalPnl >= 0 ? "text-green-600" : "text-red-600"}>
          {totalPnl >= 0 ? "+" : ""}
          {formatMoney(totalPnl)} ({totalPnlPct.toFixed(2)}%)
        </p>
        {currency === "THB" && (
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            เงินสดคงเหลือ: {formatMoney(cashTotal)}
          </p>
        )}
      </div>

      <DashboardCharts
        currency={currency}
        assets={assets}
        snapshots={snapshots}
        fundLog={fundLog}
        transactions={transactions}
        categoryBreakdown={[...byCategory.entries()].map(([category, v]) => ({
          category,
          value: v.value,
        }))}
        fundBreakdown={holdings.map((h) => ({
          name: h.asset.name,
          value: h.currentValue,
        }))}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[...byCategory.entries()].map(([cat, v]) => {
          const pnl = v.value - v.cost;
          return (
            <div
              key={cat}
              className="rounded-lg border border-black/10 p-4 dark:border-white/10"
            >
              <p className="text-xs text-black/60 dark:text-white/60">{cat}</p>
              <p className="text-lg font-semibold">{formatMoney(v.value)}</p>
              <p
                className={`text-xs ${pnl >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                {pnl >= 0 ? "+" : ""}
                {formatMoney(pnl)}
              </p>
            </div>
          );
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-black/60 dark:border-white/10 dark:text-white/60">
              <th className="py-2 pr-2"></th>
              <th className="py-2 pr-4">ชื่อ</th>
              <th className="py-2 pr-4">หมวด</th>
              <th className="py-2 pr-4 text-right">จำนวนหน่วย</th>
              <th className="py-2 pr-4 text-right">ราคาล่าสุด</th>
              <th className="py-2 pr-4 text-right">มูลค่าปัจจุบัน</th>
              <th className="py-2 pr-4 text-right">ต้นทุน</th>
              <th className="py-2 pr-4 text-right">กำไร/ขาดทุน</th>
              <th className="py-2 pr-4 text-right">% ปัจจุบัน</th>
              <th className="py-2 pr-4 text-right">% เป้าหมาย</th>
              <th className="py-2 pr-4 text-right">แนะนำ</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h, i) => {
              const currentPct = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0;
              const targetPct = h.asset.targetPct;
              const targetValue =
                targetPct !== undefined ? (targetPct / 100) * totalValue : undefined;
              const diff = targetValue !== undefined ? targetValue - h.currentValue : undefined;
              return (
                <tr
                  key={h.asset.id}
                  className="border-b border-black/5 dark:border-white/5"
                >
                  <td className="py-2 pr-2">
                    <ReorderButtons
                      assetId={h.asset.id}
                      isFirst={i === 0}
                      isLast={i === holdings.length - 1}
                    />
                  </td>
                  <td className="py-2 pr-4">{h.asset.name}</td>
                  <td className="py-2 pr-4">{h.asset.category}</td>
                  <td className="py-2 pr-4 text-right">{formatUnits(h.units)}</td>
                  <td className="py-2 pr-4 text-right">{formatUnits(h.price)}</td>
                  <td className="py-2 pr-4 text-right">
                    {formatMoney(h.currentValue)}
                  </td>
                  <td className="py-2 pr-4 text-right">{formatMoney(h.cost)}</td>
                  <td
                    className={`py-2 pr-4 text-right ${h.pnl >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {h.pnl >= 0 ? "+" : ""}
                    {formatMoney(h.pnl)} ({h.pnlPct.toFixed(1)}%)
                  </td>
                  <td className="py-2 pr-4 text-right text-black/60 dark:text-white/60">
                    {currentPct.toFixed(1)}%
                  </td>
                  <td className="py-2 pr-4 text-right">
                    <TargetPctInput assetId={h.asset.id} initialValue={targetPct} />
                  </td>
                  <td className="py-2 pr-4 text-right">
                    {diff === undefined ? (
                      <span className="text-black/40 dark:text-white/40">-</span>
                    ) : Math.abs(diff) < 1 ? (
                      <span className="text-black/60 dark:text-white/60">คงเดิม</span>
                    ) : diff > 0 ? (
                      <span className="text-green-600">ซื้อเพิ่ม {formatMoney(diff)}</span>
                    ) : (
                      <span className="text-red-600">ขาย {formatMoney(-diff)}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function DashboardPage() {
  const { accessToken, spreadsheetId } = await requireContext();
  const [assets, transactions, prices, snapshots, fundLog] = await Promise.all([
    getAssets(accessToken, spreadsheetId),
    getTransactions(accessToken, spreadsheetId),
    getPrices(accessToken, spreadsheetId),
    getSnapshots(accessToken, spreadsheetId),
    getFundLog(accessToken, spreadsheetId),
  ]);
  const holdings = computeHoldings(
    sortAssetsForDisplay(assets),
    transactions,
    prices
  ).filter((h) => h.units > 0.0001 && !h.asset.hidden);

  if (assets.length === 0) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <p className="text-black/60 dark:text-white/60">
          ยังไม่มีสินทรัพย์ในพอร์ต เริ่มต้นโดยไปที่หน้า{" "}
          <Link href="/assets" className="underline">
            สินทรัพย์
          </Link>{" "}
          เพื่อเพิ่มกองทุน/หุ้นของคุณก่อน
        </p>
      </main>
    );
  }

  const byCurrency = new Map<Currency, Holding[]>();
  for (const h of holdings) {
    const list = byCurrency.get(h.asset.currency) ?? [];
    list.push(h);
    byCurrency.set(h.asset.currency, list);
  }

  return (
    <main className="mx-auto max-w-5xl space-y-12 p-6">
      {([...byCurrency.entries()] as [Currency, Holding[]][]).map(
        ([currency, list]) => (
          <CurrencySection
            key={currency}
            currency={currency}
            holdings={list}
            assets={assets}
            snapshots={snapshots}
            fundLog={fundLog}
            transactions={transactions}
          />
        )
      )}
    </main>
  );
}
