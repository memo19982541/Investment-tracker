import { requireContext } from "@/lib/session";
import { getAssets, getTransactions } from "@/lib/data";
import { formatDate, formatMoney, formatUnits } from "@/lib/format";
import { createTransaction } from "./actions";

export default async function TransactionsPage() {
  const { accessToken, spreadsheetId } = await requireContext();
  const [assets, transactions] = await Promise.all([
    getAssets(accessToken, spreadsheetId),
    getTransactions(accessToken, spreadsheetId),
  ]);
  const assetById = new Map(assets.map((a) => [a.id, a]));
  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date));

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
        <form
          action={createTransaction}
          className="grid grid-cols-1 gap-3 rounded-lg border border-black/10 p-4 sm:grid-cols-2 dark:border-white/10"
        >
          <label className="flex flex-col gap-1 text-sm">
            สินทรัพย์
            <select
              name="assetId"
              required
              className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            ประเภทธุรกรรม
            <select
              name="type"
              className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
            >
              <option value="buy">ซื้อ</option>
              <option value="sell">ขาย</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            วันที่
            <input
              type="date"
              name="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            จำนวนหน่วย
            <input
              type="number"
              step="any"
              name="units"
              required
              className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            ราคา/NAV ต่อหน่วย
            <input
              type="number"
              step="any"
              name="pricePerUnit"
              required
              className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            หมายเหตุ (ถ้ามี)
            <input
              name="note"
              className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
            />
          </label>
          <button
            type="submit"
            className="sm:col-span-2 rounded-md bg-black py-2.5 font-medium text-white dark:bg-white dark:text-black"
          >
            บันทึกธุรกรรม
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">ประวัติธุรกรรม</h2>
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
