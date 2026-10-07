"use client";

import { useState, useTransition } from "react";
import {
  getMasterFundComparison,
  setMasterFundTicker,
  type MasterFundCostResult,
} from "@/app/assets/actions";

function money(v: number) {
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MasterFundTickerCell({
  assetId,
  ticker,
}: {
  assetId: string;
  ticker?: string;
}) {
  const [value, setValue] = useState(ticker ?? "");
  const [isSaving, startSaving] = useTransition();
  const [isCalculating, startCalculating] = useTransition();
  const [result, setResult] = useState<MasterFundCostResult | "error" | "empty" | null>(null);

  function saveTicker() {
    if (value.trim().toUpperCase() === (ticker ?? "")) return;
    startSaving(() => setMasterFundTicker(assetId, value));
  }

  function calculate() {
    setResult(null);
    startCalculating(async () => {
      try {
        const r = await getMasterFundComparison(assetId);
        setResult(r ?? "empty");
      } catch {
        setResult("error");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={saveTicker}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          disabled={isSaving}
          placeholder="เช่น IVV"
          className="w-20 rounded-md border border-black/15 px-2 py-1 text-xs uppercase disabled:opacity-50 dark:border-white/20 dark:bg-transparent"
        />
        {value.trim() && (
          <button
            type="button"
            onClick={calculate}
            disabled={isCalculating}
            className="whitespace-nowrap text-xs text-black/60 hover:underline disabled:opacity-50 dark:text-white/60"
          >
            {isCalculating ? "กำลังคำนวณ..." : "คำนวณ"}
          </button>
        )}
      </div>

      {(result === "error" || result === "empty") && (
        <p className="text-xs text-red-600">
          คำนวณไม่ได้ — ตรวจสอบว่า ticker ถูกต้อง หรือข้อมูลย้อนหลังไม่พอ
        </p>
      )}
      {result && result !== "error" && result !== "empty" && (
        <div className="text-xs text-black/60 dark:text-white/60">
          <p>
            ต้นทุนเฉลี่ย (เทียบเท่า {result.ticker}):{" "}
            <span className="font-medium text-black dark:text-white">
              {money(result.avgImpliedCost)}
            </span>
          </p>
          <p>
            ราคาปัจจุบันโดยประมาณ: {money(result.currentImpliedPrice)} (
            {result.diffPct >= 0 ? "+" : ""}
            {result.diffPct.toFixed(1)}%) — ราคาจริง {result.ticker}:{" "}
            {money(result.currentTickerPrice)}
          </p>
          <p className="opacity-70">ประมาณการ อิงราคากองทุนวันที่ {result.anchorDate} เป็นจุดอ้างอิงจุดเดียว</p>
        </div>
      )}
    </div>
  );
}
