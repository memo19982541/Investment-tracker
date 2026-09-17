import { requireContext } from "@/lib/session";
import { getAssets, getPrices } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { updatePrices } from "./actions";

export default async function PricesPage() {
  const { accessToken, spreadsheetId } = await requireContext();
  const [assets, prices] = await Promise.all([
    getAssets(accessToken, spreadsheetId),
    getPrices(accessToken, spreadsheetId),
  ]);

  if (assets.length === 0) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p className="text-sm text-black/60 dark:text-white/60">
          กรุณาเพิ่มสินทรัพย์ในหน้า &quot;สินทรัพย์&quot; ก่อน จึงจะอัปเดตราคาได้
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <div>
        <h1 className="text-lg font-semibold">อัปเดตราคา/NAV ล่าสุด</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          กรอกเฉพาะรายการที่ต้องการอัปเดต ช่องไหนเว้นว่างจะไม่เปลี่ยนแปลง
          เมื่อบันทึกแล้วระบบจะเก็บมูลค่าพอร์ตรวม ณ วันนี้ไว้ในหน้าประวัติด้วย
        </p>
      </div>
      <form action={updatePrices} className="space-y-3">
        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left text-black/60 dark:border-white/10 dark:text-white/60">
                <th className="py-2 pl-4 pr-2">ชื่อ</th>
                <th className="py-2 pr-2">หมวด</th>
                <th className="py-2 pr-2 text-right">ราคาปัจจุบัน</th>
                <th className="py-2 pr-4 text-right">ราคาใหม่</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => {
                const p = prices[a.id];
                return (
                  <tr
                    key={a.id}
                    className="border-b border-black/5 last:border-0 dark:border-white/5"
                  >
                    <td className="py-2 pl-4 pr-2">{a.name}</td>
                    <td className="py-2 pr-2">{a.category}</td>
                    <td className="py-2 pr-2 text-right text-black/60 dark:text-white/60">
                      {p ? `${p.price} (${formatDate(p.updatedAt)})` : "-"}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <input
                        type="number"
                        step="any"
                        name={`price_${a.id}`}
                        placeholder={p ? String(p.price) : "0.00"}
                        className="w-28 rounded-md border border-black/15 px-2 py-1 text-right dark:border-white/20 dark:bg-transparent"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-black py-2.5 font-medium text-white dark:bg-white dark:text-black"
        >
          บันทึกราคาและเก็บสแนปช็อตวันนี้
        </button>
      </form>
    </main>
  );
}
