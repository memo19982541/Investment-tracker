import { Fragment } from "react";
import { requireContext } from "@/lib/session";
import { computeHoldings, getAssets, getPrices, getTransactions } from "@/lib/data";
import { formatUnits } from "@/lib/format";
import { sortAssetsForPicker } from "@/lib/assetPicker";
import { DEFAULT_CATEGORIES } from "@/lib/types";
import DeleteAssetButton from "@/components/DeleteAssetButton";
import HideAssetToggle from "@/components/HideAssetToggle";
import MasterFundTickerCell from "@/components/MasterFundTickerCell";
import PaysDividendToggle from "@/components/PaysDividendToggle";
import { createAsset } from "./actions";

export default async function AssetsPage() {
  const { accessToken, spreadsheetId } = await requireContext();
  const [assets, transactions, prices] = await Promise.all([
    getAssets(accessToken, spreadsheetId),
    getTransactions(accessToken, spreadsheetId),
    getPrices(accessToken, spreadsheetId),
  ]);
  const assetIdsWithTransactions = new Set(transactions.map((t) => t.assetId));
  const holdingById = new Map(
    computeHoldings(assets, transactions, prices).map((h) => [h.asset.id, h])
  );

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
              <option value="cash">เงินสด</option>
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
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="paysDividend" className="h-4 w-4" />
            กองทุนนี้จ่ายปันผล (ปิดการคำนวณเทียบกองทุนแม่ให้อัตโนมัติ)
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
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/10 text-left text-black/60 dark:border-white/10 dark:text-white/60">
                  <th className="py-2 pr-4">ชื่อ</th>
                  <th className="py-2 pr-4">ประเภท</th>
                  <th className="py-2 pr-4">หมวด</th>
                  <th className="py-2 pr-4">สกุลเงิน</th>
                  <th className="py-2 pr-4">กองทุนแม่</th>
                  <th className="py-2 pr-4"></th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {sortAssetsForPicker(assets).map((a) => {
                  const h = holdingById.get(a.id);
                  // One compact detail line under each fund/stock: units held,
                  // average cost per unit, and the latest price.
                  const detailParts: string[] = [];
                  if (a.type !== "cash" && h) {
                    if (h.units > 0.0001) {
                      detailParts.push(`จำนวนหน่วย ${formatUnits(h.units)}`);
                      detailParts.push(`ต้นทุน/หน่วย ${formatUnits(h.cost / h.units)}`);
                    }
                    if (h.price > 0) detailParts.push(`ราคาล่าสุด ${formatUnits(h.price)}`);
                  }
                  const hasDetail = detailParts.length > 0;
                  const tone = a.hidden ? "text-black/40 dark:text-white/40" : "";
                  const divider = "border-b border-black/5 dark:border-white/5";
                  return (
                    <Fragment key={a.id}>
                      <tr className={`${hasDetail ? "" : divider} ${tone}`}>
                        <td className="py-2 pr-4">
                          {a.name}
                          {a.type === "fund" && a.currency === "THB" && (
                            <span className="ml-1.5 align-middle">
                              <PaysDividendToggle
                                assetId={a.id}
                                paysDividend={!!a.paysDividend}
                              />
                            </span>
                          )}
                          {a.hidden && (
                            <span className="ml-2 rounded-full border border-black/15 px-2 py-0.5 text-[10px] dark:border-white/20">
                              ซ่อนอยู่
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          {a.type === "fund"
                            ? "กองทุน"
                            : a.type === "stock"
                              ? "หุ้น"
                              : "เงินสด"}
                        </td>
                        <td className="py-2 pr-4">{a.category}</td>
                        <td className="py-2 pr-4">{a.currency}</td>
                        <td className="py-2 pr-4">
                          {a.type === "fund" && a.currency === "THB" && !a.paysDividend && (
                            <MasterFundTickerCell assetId={a.id} ticker={a.masterFundTicker} />
                          )}
                        </td>
                        <td className="py-2 pr-4 text-right">
                          <HideAssetToggle assetId={a.id} hidden={!!a.hidden} />
                        </td>
                        <td className="py-2 pr-4 text-right">
                          <DeleteAssetButton
                            assetId={a.id}
                            assetName={a.name}
                            hasTransactions={assetIdsWithTransactions.has(a.id)}
                          />
                        </td>
                      </tr>
                      {hasDetail && (
                        <tr className={`${divider} ${tone}`}>
                          <td
                            colSpan={7}
                            className="pb-2 text-xs text-black/50 dark:text-white/50"
                          >
                            <div className="sticky left-0 w-[calc(100vw-3rem)] max-w-full">
                              {detailParts.join(" · ")}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-black/50 dark:text-white/50">
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-amber-500 align-middle" />
            = กองทุนจ่ายปันผล จึงคำนวณเทียบกองทุนแม่ไม่ได้ (NAV ไม่โตตามกองทุนแม่) — กดที่จุดหลังชื่อกองทุนเพื่อสลับสถานะ
            จุดโปร่งจางๆ = ไม่จ่ายปันผล
          </p>
          </>
        )}
      </section>
    </main>
  );
}
