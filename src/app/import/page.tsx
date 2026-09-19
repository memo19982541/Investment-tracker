import {
  importAssets,
  importFundLog,
  importSnapshots,
  importTransactions,
} from "./actions";

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
  const flCreated = sp.flCreated as string | undefined;
  const flInvalid = sp.flInvalid as string | undefined;
  const flOverwritten = sp.flOverwritten as string | undefined;
  const flUnmatched = sp.flUnmatched as string | undefined;
  const snCreated = sp.snCreated as string | undefined;
  const snInvalid = sp.snInvalid as string | undefined;
  const snDuplicate = sp.snDuplicate as string | undefined;

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

      <section className="space-y-3">
        <h2 className="font-medium">3) นำเข้าประวัติมูลค่ากองทุน (สำหรับกราฟย้อนหลัง)</h2>
        <p className="text-sm text-black/60 dark:text-white/60">
          คัดลอกจากแท็บ &quot;บันทึกหน่วยกองทุน&quot; ในชีทเดิม (คอลัมน์ A ถึง H)
          <br />
          แต่ละบรรทัด:{" "}
          <code>
            วันที่, ชื่อกองทุน, จำนวนหน่วย, NAV/ราคา, ราคาทุนเฉลี่ย/หน่วย, มูลค่าปัจจุบัน,
            มูลค่าต้นทุน, กำไร/ขาดทุน
          </code>
          <br />
          ชื่อกองทุนต้องตรงกับที่มีอยู่แล้วในขั้นตอนที่ 1
        </p>
        {flCreated !== undefined && (
          <div className="space-y-1 rounded-md bg-green-600/10 p-3 text-sm text-green-700 dark:text-green-400">
            <p>นำเข้าประวัติมูลค่ากองทุนสำเร็จ {flCreated} รายการ</p>
            {Number(flInvalid) > 0 && <p>ข้ามแถวที่ข้อมูลไม่ถูกต้อง {flInvalid} รายการ</p>}
            {Number(flOverwritten) > 0 && (
              <p>เขียนทับแถวที่มีอยู่แล้ว (วันที่ + กองทุนซ้ำ) {flOverwritten} รายการ</p>
            )}
            {flUnmatched ? (
              <p>
                หากองทุนไม่เจอสำหรับชื่อ: {decodeURIComponent(flUnmatched)}{" "}
                — เพิ่มในขั้นตอนที่ 1 ก่อนแล้วนำเข้าใหม่
              </p>
            ) : null}
          </div>
        )}
        <form action={importFundLog} className="space-y-3">
          <textarea
            name="data"
            required
            rows={12}
            placeholder={
              "28/7/2026, SCBS&P500, 7167.11, 28.33, 29.30, 203054.25, 210000, -6945.75"
            }
            className="w-full rounded-md border border-black/15 p-3 font-mono text-xs dark:border-white/20 dark:bg-transparent"
          />
          <button
            type="submit"
            className="rounded-md bg-black px-4 py-2 font-medium text-white dark:bg-white dark:text-black"
          >
            นำเข้าประวัติมูลค่ากองทุน
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">4) นำเข้าประวัติมูลค่าพอร์ตรวม (สำหรับกราฟย้อนหลัง)</h2>
        <p className="text-sm text-black/60 dark:text-white/60">
          คัดลอกจากแท็บ &quot;บันทึกข้อมูล&quot; ในชีทเดิม เฉพาะคอลัมน์: วันที่บันทึก, มูลค่าพอร์ตรวม,
          ทุนรวม (ต้นทุน), ประเภท: CORE, ประเภท: Cash, ประเภท: Future, ประเภท: Gold
          <br />
          แต่ละบรรทัด: <code>วันที่, มูลค่าพอร์ตรวม, ทุนรวม, CORE, Cash, Future, Gold</code>{" "}
          (เว้นว่างช่องหมวดที่ไม่มีได้)
          <br />
          ตัวอย่าง: <code>28/7/2026, 841554.10, 787652.84, 478857.89, 336456.63, 24783.31, 1456.27</code>
        </p>
        {snCreated !== undefined && (
          <div className="space-y-1 rounded-md bg-green-600/10 p-3 text-sm text-green-700 dark:text-green-400">
            <p>นำเข้าประวัติมูลค่าพอร์ตสำเร็จ {snCreated} รายการ</p>
            {Number(snInvalid) > 0 && <p>ข้ามแถวที่ข้อมูลไม่ถูกต้อง {snInvalid} รายการ</p>}
            {Number(snDuplicate) > 0 && (
              <p>ข้ามแถวที่มีอยู่แล้ว (วันที่ซ้ำ) {snDuplicate} รายการ</p>
            )}
          </div>
        )}
        <form action={importSnapshots} className="space-y-3">
          <textarea
            name="data"
            required
            rows={12}
            placeholder={
              "28/7/2026, 841554.10, 787652.84, 478857.89, 336456.63, 24783.31, 1456.27"
            }
            className="w-full rounded-md border border-black/15 p-3 font-mono text-xs dark:border-white/20 dark:bg-transparent"
          />
          <button
            type="submit"
            className="rounded-md bg-black px-4 py-2 font-medium text-white dark:bg-white dark:text-black"
          >
            นำเข้าประวัติมูลค่าพอร์ต
          </button>
        </form>
      </section>
    </main>
  );
}
