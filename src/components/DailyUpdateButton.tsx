"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runDailyUpdateNow } from "@/app/prices/actions";

type Status = "idle" | "done" | "error";

export default function DailyUpdateButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<Status>("idle");
  const [failedCount, setFailedCount] = useState(0);

  function handleClick() {
    startTransition(async () => {
      try {
        const res = await runDailyUpdateNow();
        setFailedCount(res.failed.length);
        setStatus("done");
        router.refresh();
      } catch {
        setStatus("error");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      title="ดึงราคากองทุน/หุ้นล่าสุดและบันทึก snapshot ของวันนี้"
      className="shrink-0 rounded-md border border-black/15 px-2.5 py-1 text-xs text-black/70 hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:text-white/70 dark:hover:bg-white/10"
    >
      {isPending
        ? "กำลังดึงราคา..."
        : status === "done"
          ? failedCount > 0
            ? `เสร็จแล้ว (${failedCount} รายการไม่สำเร็จ)`
            : "เสร็จแล้ว ✓"
          : status === "error"
            ? "ผิดพลาด ลองใหม่"
            : "ดึงราคาล่าสุด"}
    </button>
  );
}
