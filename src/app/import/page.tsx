import { importAssets, importTransactions } from "./actions";

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const assetsCreated = sp.assetsCreated as string | undefined;
  const assetsSkipped = sp.assetsSkipped as string | undefined;
  const txCreated = sp.txCreated as string | undefined;
  const txInvalid = sp.txInvalid as string | undefined;
  const txUnmatched = sp.txUnmatched as string | undefined;

  return (
    <main className="mx-auto max-w-3xl space-y-10 p-6">
      <div>
        <h1 className="text-lg font-semibold">นำเข้าข้อมูลเก่า</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          คัดลอกข้อมูลจากไฟล์ Google Sheets เดิมของคุณ แล้ววางลงในช่องด้านล่าง
          (คัดลอกทั้งช่วงเซลล์มาวางได้เลย ระบบจะแยกคอลัมน์ให้อัตโนมัติ)
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-medium">1) นำเข้าสินทรัพย์ (กองทุน/หุ้น)</h2>
        <p className="text-sm text-black/60 dark:text-white/60">
          แต่ละบรรทัด: <code>ชื่อ, ประเภท(fund หรือ stock), หมวด, สกุลเงิน(THB หรือ USD)</code>
          <br />
          ตัวอย่าง: <code>SCBS&P500, fund, CORE, THB</code>
        </p>
        {assetsCreated !== undefined && (
          <p className="rounded-md bg-green-600/10 p-3 text-sm text-green-700 dark:text-green-400">
            เพิ่มสินทรัพย์ใหม่ {assetsCreated} รายการ (ข้ามที่มีอยู่แล้ว {assetsSkipped} รายการ)
          </p>
        )}
        <form action={importAssets} className="space-y-3">
          <textarea
            name="data"
            required
            rows={8}
            placeholder={"SCBS&P500, fund, CORE, THB\nSCBGOLD, fund, Gold, THB\nMO, stock, หุ้นสหรัฐ, USD"}
            className="w-full rounded-md border border-black/15 p-3 font-mono text-xs dark:border-white/20 dark:bg-transparent"
          />
          <button
            type="submit"
            className="rounded-md bg-black px-4 py-2 font-medium text-white dark:bg-white dark:text-black"
          >
            นำเข้าสินทรัพย์
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">2) นำเข้าธุรกรรม (ซื้อ/ขาย)</h2>
        <p className="text-sm text-black/60 dark:text-white/60">
          แต่ละบรรทัด: <code>วันที่, ชื่อสินทรัพย์, ประเภท(ซื้อ/ขาย), จำนวนหน่วย, ราคา</code>
          <br />
          ชื่อสินทรัพย์ต้องตรงกับที่นำเข้าไว้ในขั้นตอนที่ 1 (ทำขั้นตอน 1 ให้เสร็จก่อน)
          <br />
          ตัวอย่าง: <code>12/8/2026, SCBS&P500, ซื้อ, 100, 29.30</code>
        </p>
        {txCreated !== undefined && (
          <div className="space-y-1 rounded-md bg-green-600/10 p-3 text-sm text-green-700 dark:text-green-400">
            <p>นำเข้าธุรกรรมสำเร็จ {txCreated} รายการ</p>
            {Number(txInvalid) > 0 && <p>ข้ามแถวที่ข้อมูลไม่ถูกต้อง {txInvalid} รายการ</p>}
            {txUnmatched ? (
              <p>
                หาสินทรัพย์ไม่เจอสำหรับชื่อ: {decodeURIComponent(txUnmatched)}{" "}
                — เพิ่มในขั้นตอนที่ 1 ก่อนแล้วนำเข้าใหม่
              </p>
            ) : null}
          </div>
        )}
        <form action={importTransactions} className="space-y-3">
          <textarea
            name="data"
            required
            rows={12}
            placeholder={"12/8/2026, SCBS&P500, ซื้อ, 100, 29.30\n5/8/2026, MO, ซื้อ, 4.02, 67.68"}
            className="w-full rounded-md border border-black/15 p-3 font-mono text-xs dark:border-white/20 dark:bg-transparent"
          />
          <button
            type="submit"
            className="rounded-md bg-black px-4 py-2 font-medium text-white dark:bg-white dark:text-black"
          >
            นำเข้าธุรกรรม
          </button>
        </form>
      </section>
    </main>
  );
}
