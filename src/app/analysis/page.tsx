import Link from "next/link";
import { requireContext } from "@/lib/session";
import {
  computeHoldings,
  getAssets,
  getPrices,
  getSnapshots,
  getTransactions,
} from "@/lib/data";
import AnalysisSection from "@/components/AnalysisSection";
import type { Currency, Holding } from "@/lib/types";

const CURRENCY_LABEL: Record<Currency, string> = {
  THB: "พอร์ตบาท (THB)",
  USD: "พอร์ตดอลลาร์ (USD)",
};

export default async function AnalysisPage() {
  const { accessToken, spreadsheetId } = await requireContext();
  const [assets, transactions, prices, snapshots] = await Promise.all([
    getAssets(accessToken, spreadsheetId),
    getTransactions(accessToken, spreadsheetId),
    getPrices(accessToken, spreadsheetId),
    getSnapshots(accessToken, spreadsheetId),
  ]);

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

  const holdings = computeHoldings(assets, transactions, prices).filter(
    (h) => h.units > 0.0001 && !h.asset.hidden
  );
  const byCurrency = new Map<Currency, Holding[]>();
  for (const h of holdings) {
    const list = byCurrency.get(h.asset.currency) ?? [];
    list.push(h);
    byCurrency.set(h.asset.currency, list);
  }

  return (
    <main className="mx-auto max-w-5xl space-y-12 p-6">
      <h1 className="text-lg font-semibold">วิเคราะห์ผลการลงทุน</h1>
      {([...byCurrency.entries()] as [Currency, Holding[]][]).map(
        ([currency, currencyHoldings]) => (
          <section key={currency} className="space-y-4">
            <p className="text-sm text-black/60 dark:text-white/60">
              {CURRENCY_LABEL[currency]}
            </p>
            <AnalysisSection
              currency={currency}
              assets={assets}
              transactions={transactions}
              snapshots={snapshots}
              holdings={currencyHoldings}
            />
          </section>
        )
      )}
    </main>
  );
}
