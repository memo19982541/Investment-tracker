"use client";

import { useState, useTransition } from "react";
import { addMonthlySnapshots } from "@/app/history/actions";

export default function AddMonthlySnapshotsForm() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [fromMonth, setFromMonth] = useState("2026-02");
  const [toMonth, setToMonth] = useState("2026-07");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await addMonthlySnapshots(fromMonth, toMonth);
      setResult(
        `เพิ่ม ${r.snapshotsAdded} snapshot (${r.fundLogRowsAdded} แถวราคากองทุน) จาก ${r.monthsChecked} เดือนที่ตรวจสอบ`
      );
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-2 rounded-lg border border-black/10 p-3 text-xs dark:border-white/10"
    >
      <label className="flex flex-col gap-1">
        ตั้งแต่เดือน
        <input
          type="month"
          value={fromMonth}
          onChange={(e) => setFromMonth(e.target.value)}
          className="rounded-md border border-black/15 px-2 py-1 dark:border-white/20 dark:bg-transparent"
        />
      </label>
      <label className="flex flex-col gap-1">
        ถึงก่อนเดือน
        <input
          type="month"
          value={toMonth}
          onChange={(e) => setToMonth(e.target.value)}
          className="rounded-md border border-black/15 px-2 py-1 dark:border-white/20 dark:bg-transparent"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-full border border-black/20 px-2.5 py-1.5 dark:border-white/30 disabled:opacity-50"
      >
        {isPending ? "กำลังเพิ่ม..." : "เพิ่ม snapshot รายเดือนย้อนหลัง"}
      </button>
      {result && <span className="text-black/60 dark:text-white/60">{result}</span>}
    </form>
  );
}
