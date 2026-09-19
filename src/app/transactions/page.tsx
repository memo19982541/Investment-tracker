import { requireContext } from "@/lib/session";
import { getAssets, getFundLog, getTransactions } from "@/lib/data";
import { formatDate, formatMoney, formatUnits } from "@/lib/format";
import AssetFilter from "@/components/AssetFilter";
import DeleteTransactionButton from "@/components/DeleteTransactionButton";
import FundPriceChart from "@/components/FundPriceChart";
import TransactionForm from "@/components/TransactionForm";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ assetId?: string }>;
}) {
  const { accessToken, spreadsheetId } = await requireContext();
  const [assets, transactions, fundLog] = await Promise.all([
    getAssets(accessToken, spreadsheetId),
    getTransactions(accessToken, spreadsheetId),
    getFundLog(accessToken, spreadsheetId),
  ]);
  const assetById = new Map(assets.map((a) => [a.id, a]));
  const { assetId: filterAssetId } = await searchParams;
  const filtered = filterAssetId
    ? transactions.filter((t) => t.assetId === filterAssetId)
    : transactions;
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date));
  const filterAsset = filterAssetId ? assetById.get(filterAssetId) : undefined;

  if (assets.length === 0) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-black/60 dark:text-white/60">
          กรุณาเพิ่มสินทรัพย์ในหน้า &quot;สินทรัพย์&quot; ก่อน จึงจะบันทึกธุรกรรมได้
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-6">
      <section>
        <h1 className="mb-4 text-lg font-semibold">บันทึกธุรกรรมซื้อ/ขาย</h1>
        <TransactionForm assets={assets} />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">ประวัติธุรกรรม</h2>
          <AssetFilter assets={assets} />
        </div>

        {filterAsset?.type === "fund" && (
          <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            <p className="mb-2 text-sm font-medium">
              เทียบธุรกรรมกับดัชนี NAV ของ {filterAsset.name}
            </p>
            <FundPriceChart assetId={filterAsset.id} fundLog={fundLog} transactions={transactions} />
          </div>
        )}

        {sorted.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">
            ยังไม่มีธุรกรรม
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/10 text-left text-black/60 dark:border-white/10 dark:text-white/60">
                  <th className="py-2 pr-4">วันที่</th>
                  <th className="py-2 pr-4">สินทรัพย์</th>
                  <th className="py-2 pr-4">ประเภท</th>
                  <th className="py-2 pr-4 text-right">จำนวนหน่วย</th>
                  <th className="py-2 pr-4 text-right">ราคา/หน่วย</th>
                  <th className="py-2 pr-4 text-right">มูลค่ารวม</th>
                  <th className="py-2 pr-4">หมายเหตุ</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-black/5 dark:border-white/5"
                  >
                    <td className="py-2 pr-4">{formatDate(t.date)}</td>
                    <td className="py-2 pr-4">
                      {assetById.get(t.assetId)?.name ?? t.assetId}
                    </td>
                    <td className="py-2 pr-4">
                      {t.type === "buy" ? "ซื้อ" : "ขาย"}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {formatUnits(t.units)}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {formatUnits(t.pricePerUnit)}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {formatMoney(t.totalValue)}
                    </td>
                    <td className="py-2 pr-4 text-black/60 dark:text-white/60">
                      {t.note}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <DeleteTransactionButton transactionId={t.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
