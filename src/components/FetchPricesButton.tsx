"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  fetchLatestFundPrices,
  type FetchPricesResult,
} from "@/app/prices/actions";

export default function FetchPricesButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<FetchPricesResult | null>(null);

  function handleClick() {
    setResult(null);
    startTransition(async () => {
      const res = await fetchLatestFundPrices();
      setResult(res);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">ดึงราคาล่าสุดอัตโนมัติ</p>
          <p className="text-xs text-black/60 dark:text-white/60">
            กองทุนดึงจาก settrade.com, หุ้นดึงจาก Yahoo Finance ตามชื่อสินทรัพย์ —
            อัปเดตแค่ราคาปัจจุบัน ยังไม่เก็บสแนปช็อต ต้องกด
            &quot;บันทึกราคาและเก็บสแนปช็อตวันนี้&quot; ด้านล่างอีกที
          </p>
        </div>
        <button
          type="button"
          onClick={handleClick}
          disabled={isPending}
          className="shrink-0 rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {isPending ? "กำลังดึงราคา..." : "ดึงราคาล่าสุด"}
        </button>
      </div>

      {result && (
        <div className="mt-3 space-y-1 text-xs">
          {result.updated.length > 0 && (
            <p className="text-green-600">
              อัปเดตสำเร็จ {result.updated.length} รายการ:{" "}
              {result.updated
                .map((u) => `${u.name} = ${u.price} (${u.navDate})`)
                .join(", ")}
            </p>
          )}
          {result.failed.length > 0 && (
            <p className="text-red-600">
              ดึงราคาไม่สำเร็จ {result.failed.length} รายการ:{" "}
              {result.failed.map((f) => f.name).join(", ")}
            </p>
          )}
          {result.updated.length === 0 && result.failed.length === 0 && (
            <p className="text-black/60 dark:text-white/60">
              ไม่มีกองทุนให้ดึงราคา
            </p>
          )}
        </div>
      )}
    </div>
  );
}
