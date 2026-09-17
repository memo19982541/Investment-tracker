import { requireContext } from "@/lib/session";
import { getSnapshots } from "@/lib/data";
import { formatDate, formatMoney } from "@/lib/format";
import HistoryChart from "@/components/HistoryChart";

export default async function HistoryPage() {
  const { accessToken, spreadsheetId } = await requireContext();
  const snapshots = await getSnapshots(accessToken, spreadsheetId);
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length === 0) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <p className="text-sm text-black/60 dark:text-white/60">
          ยังไม่มีประวัติ ไปที่หน้า &quot;อัปเดตราคา&quot; แล้วกดบันทึก
          ระบบจะเริ่มเก็บมูลค่าพอร์ตรายวันให้อัตโนมัติ
        </p>
      </main>
    );
  }

  const points = sorted.map((s) => ({
    date: formatDate(s.date),
    totalValue: s.totalValue,
    totalCost: s.totalCost,
  }));

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-lg font-semibold">ประวัติมูลค่าพอร์ต</h1>
      <HistoryChart points={points} />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-black/60 dark:border-white/10 dark:text-white/60">
              <th className="py-2 pr-4">วันที่</th>
              <th className="py-2 pr-4 text-right">มูลค่าพอร์ตรวม</th>
              <th className="py-2 pr-4 text-right">ทุนรวม</th>
              <th className="py-2 pr-4 text-right">กำไร/ขาดทุน</th>
            </tr>
          </thead>
          <tbody>
            {[...sorted].reverse().map((s, i) => {
              const pnl = s.totalValue - s.totalCost;
              return (
                <tr key={i} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-2 pr-4">{formatDate(s.date)}</td>
                  <td className="py-2 pr-4 text-right">{formatMoney(s.totalValue)}</td>
                  <td className="py-2 pr-4 text-right">{formatMoney(s.totalCost)}</td>
                  <td
                    className={`py-2 pr-4 text-right ${pnl >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {pnl >= 0 ? "+" : ""}
                    {formatMoney(pnl)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
