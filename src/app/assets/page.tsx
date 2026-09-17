import { requireContext } from "@/lib/session";
import { getAssets } from "@/lib/data";
import { DEFAULT_CATEGORIES } from "@/lib/types";
import { createAsset } from "./actions";

export default async function AssetsPage() {
  const { accessToken, spreadsheetId } = await requireContext();
  const assets = await getAssets(accessToken, spreadsheetId);

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-6">
      <section>
        <h1 className="mb-4 text-lg font-semibold">เพิ่มสินทรัพย์ใหม่</h1>
        <form
          action={createAsset}
          className="grid grid-cols-1 gap-3 rounded-lg border border-black/10 p-4 sm:grid-cols-2 dark:border-white/10"
        >
          <label className="flex flex-col gap-1 text-sm">
            ชื่อสินทรัพย์
            <input
              name="name"
              required
              placeholder="เช่น SCBS&P500"
              className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            ประเภท
            <select
              name="type"
              className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
            >
              <option value="fund">กองทุน</option>
              <option value="stock">หุ้น</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            หมวดพอร์ต
            <input
              name="category"
              required
              list="category-options"
              placeholder="เช่น CORE"
              className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
            />
            <datalist id="category-options">
              {DEFAULT_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            สกุลเงิน
            <select
              name="currency"
              className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
            >
              <option value="THB">บาท (THB)</option>
              <option value="USD">ดอลลาร์ (USD)</option>
            </select>
          </label>
          <button
            type="submit"
            className="sm:col-span-2 rounded-md bg-black py-2.5 font-medium text-white dark:bg-white dark:text-black"
          >
            เพิ่มสินทรัพย์
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">สินทรัพย์ทั้งหมด</h2>
        {assets.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">
            ยังไม่มีสินทรัพย์
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/10 text-left text-black/60 dark:border-white/10 dark:text-white/60">
                  <th className="py-2 pr-4">ชื่อ</th>
                  <th className="py-2 pr-4">ประเภท</th>
                  <th className="py-2 pr-4">หมวด</th>
                  <th className="py-2 pr-4">สกุลเงิน</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-black/5 dark:border-white/5"
                  >
                    <td className="py-2 pr-4">{a.name}</td>
                    <td className="py-2 pr-4">
                      {a.type === "fund" ? "กองทุน" : "หุ้น"}
                    </td>
                    <td className="py-2 pr-4">{a.category}</td>
                    <td className="py-2 pr-4">{a.currency}</td>
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
