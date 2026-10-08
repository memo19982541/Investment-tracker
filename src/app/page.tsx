import Link from "next/link";
import { requireContext } from "@/lib/session";

// The "ดึงราคาล่าสุด" button's server action fetches NAV/prices for every
// asset from settrade.com/Yahoo Finance, which is network-bound and can
// take a while — extend past the platform's default function timeout so a
// foreground click doesn't get killed mid-request.
export const maxDuration = 60;
import {
  computeHoldings,
  getAssets,
  getFundLog,
  getPrices,
  getSnapshots,
  getTransactions,
  sortAssetsForDisplay,
} from "@/lib/data";
import { computeChangeSincePrevious } from "@/lib/analytics";
import { dailyMessage, dailyTier } from "@/lib/cheer";
import { formatDateWithWeekday, formatMoney, todayInThailand } from "@/lib/format";
import DailyUpdateButton from "@/components/DailyUpdateButton";
import DashboardCharts from "@/components/DashboardCharts";
import { CheerBust, GoalProgressBar } from "@/components/GoalProgress";
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
  showUpdateButton,
}: {
  currency: Currency;
  holdings: Holding[];
  assets: Asset[];
  snapshots: Snapshot[];
  fundLog: FundLogEntry[];
  transactions: Transaction[];
  showUpdateButton?: boolean;
}) {
  const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0);
  const totalCost = holdings.reduce((s, h) => s + h.cost, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const targetPctSum = holdings.reduce((s, h) => s + (h.asset.targetPct ?? 0), 0);
  const cashTotal = holdings
    .filter((h) => h.asset.type === "cash")
    .reduce((s, h) => s + h.currentValue, 0);
  const dailyChange = computeChangeSincePrevious(
    snapshots,
    transactions,
    assets,
    currency,
    totalValue,
    totalCost,
    todayInThailand()
  );

  const tier = dailyTier(dailyChange?.pct);
  const cheerLine = currency === "THB" ? dailyMessage(tier, todayInThailand()) : null;

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
      <div className="flex items-end gap-2 sm:gap-4">
      <div className="min-w-0 flex-1 pb-2">
        <p className="text-sm text-black/60 dark:text-white/60">
          {CURRENCY_LABEL[currency]}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="text-3xl font-bold sm:text-4xl">{formatMoney(totalValue)}</p>
          {showUpdateButton && currency !== "THB" && <DailyUpdateButton />}
        </div>
        <p className={totalPnl >= 0 ? "text-green-600" : "text-red-600"}>
          {totalPnl >= 0 ? "+" : ""}
          {formatMoney(totalPnl)} ({totalPnlPct.toFixed(2)}%)
        </p>
        {dailyChange && (
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            เปลี่ยนจากบันทึกก่อนหน้า ({formatDateWithWeekday(dailyChange.prevDate)}):{" "}
            <span className={dailyChange.change >= 0 ? "text-green-600" : "text-red-600"}>
              {dailyChange.change >= 0 ? "+" : ""}
              {formatMoney(dailyChange.change)} ({dailyChange.change >= 0 ? "+" : ""}
              {dailyChange.pct.toFixed(2)}%)
            </span>
          </p>
        )}
        {cheerLine && (
          <p className="mt-0.5 text-xs font-medium text-pink-600 dark:text-pink-400">{cheerLine}</p>
        )}
        {currency === "THB" && (
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            เงินสดคงเหลือ: {formatMoney(cashTotal)}
          </p>
        )}
      </div>
      {currency === "THB" && <CheerBust tier={tier} />}
      </div>
      {currency === "THB" && (
        <GoalProgressBar
          value={totalValue}
          action={showUpdateButton ? <DailyUpdateButton /> : undefined}
        />
      )}
      </div>

      <DashboardCharts
        currency={currency}
        assets={assets}
        snapshots={snapshots}
        fundLog={fundLog}
        transactions={transactions}
        live={{ date: todayInThailand(), value: totalValue, cost: totalCost }}
        categoryBreakdown={[...byCategory.entries()].map(([category, v]) => ({
          category,
          value: v.value,
          cost: v.cost,
        }))}
        fundBreakdown={holdings.map((h) => ({
          name: h.asset.name,
          value: h.currentValue,
        }))}
      />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-black/60 dark:border-white/10 dark:text-white/60">
              <th className="py-2 pr-2"></th>
              <th className="py-2 pr-4">ชื่อ</th>
              <th className="py-2 pr-4">หมวด</th>
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
          <tfoot>
            <tr className="border-t border-black/10 font-medium dark:border-white/10">
              <td className="py-2 pr-2"></td>
              <td className="py-2 pr-4" colSpan={5}>
                รวม
              </td>
              <td className="py-2 pr-4 text-right text-black/60 dark:text-white/60">
                {holdings
                  .reduce((sum, h) => sum + (totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0), 0)
                  .toFixed(1)}
                %
              </td>
              <td
                className={`py-2 pr-4 text-right ${
                  Math.abs(targetPctSum - 100) < 0.05 ? "text-green-600" : "text-amber-600"
                }`}
              >
                {targetPctSum.toFixed(1)}%
                {Math.abs(targetPctSum - 100) >= 0.05 && (
                  <span className="block text-xs font-normal">
                    {targetPctSum < 100
                      ? `ขาดอีก ${(100 - targetPctSum).toFixed(1)}%`
                      : `เกิน ${(targetPctSum - 100).toFixed(1)}%`}
                  </span>
                )}
              </td>
              <td className="py-2 pr-4"></td>
            </tr>
          </tfoot>
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
        ([currency, list], i) => (
          <CurrencySection
            key={currency}
            currency={currency}
            holdings={list}
            assets={assets}
            snapshots={snapshots}
            fundLog={fundLog}
            transactions={transactions}
            showUpdateButton={i === 0}
          />
        )
      )}
    </main>
  );
}
