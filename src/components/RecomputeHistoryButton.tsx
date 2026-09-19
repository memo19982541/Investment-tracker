"use client";

import { useState, useTransition } from "react";
import { recomputeHistory } from "@/app/history/actions";

export default function RecomputeHistoryButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function handleClick() {
    startTransition(async () => {
      const r = await recomputeHistory();
      setResult(
        `อัปเดตแล้ว ${r.snapshotsUpdated} วัน (${r.fundLogRowsUpdated} แถวราคากองทุน)`
      );
    });
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-full border border-black/20 px-2.5 py-1 dark:border-white/30 disabled:opacity-50"
      >
        {isPending ? "กำลังคำนวณใหม่..." : "คำนวณประวัติใหม่จากธุรกรรมล่าสุด"}
      </button>
      {result && <span className="text-black/60 dark:text-white/60">{result}</span>}
    </div>
  );
}
