"use client";

import { useState, useTransition } from "react";
import {
  getMasterFundComparison,
  setMasterFundCurrency,
  setMasterFundTicker,
  type MasterFundCostResult,
} from "@/app/assets/actions";

const CURRENCY_OPTIONS = ["USD", "JPY", "EUR", "GBP", "HKD", "CNY", "AUD"];

function money(v: number) {
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MasterFundTickerCell({
  assetId,
  ticker,
  currency,
}: {
  assetId: string;
  ticker?: string;
  currency?: string;
}) {
  const [value, setValue] = useState(ticker ?? "");
  const [currencyValue, setCurrencyValue] = useState(currency || "USD");
  const [isSaving, startSaving] = useTransition();
  const [isCalculating, startCalculating] = useTransition();
  const [result, setResult] = useState<MasterFundCostResult | "error" | "empty" | null>(null);

  function saveTicker() {
    if (value.trim().toUpperCase() === (ticker ?? "")) return;
    startSaving(() => setMasterFundTicker(assetId, value));
  }

  function saveCurrency(next: string) {
    setCurrencyValue(next);
    startSaving(() => setMasterFundCurrency(assetId, next));
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
        <select
          value={currencyValue}
          onChange={(e) => saveCurrency(e.target.value)}
          disabled={isSaving}
          className="rounded-md border border-black/15 px-1 py-1 text-xs disabled:opacity-50 dark:border-white/20 dark:bg-transparent"
        >
          {CURRENCY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
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
          คำนวณไม่ได้ — ตรวจสอบว่า ticker/สกุลเงินถูกต้อง หรือข้อมูลย้อนหลังไม่พอ
        </p>
      )}
      {result && result !== "error" && result !== "empty" && (
        <div className="text-xs text-black/60 dark:text-white/60">
          <p>
            ต้นทุนเฉลี่ย (เทียบเท่า {result.ticker}):{" "}
            <span className="font-medium text-black dark:text-white">
              {result.currency} {money(result.avgImpliedCost)}
            </span>
          </p>
          <p>
            ราคาปัจจุบันโดยประมาณ: {result.currency} {money(result.currentImpliedPrice)} (
            {result.diffPct >= 0 ? "+" : ""}
            {result.diffPct.toFixed(1)}%) — ราคาจริง {result.ticker}: {result.currency}{" "}
            {money(result.currentTickerPrice)}
          </p>
          <p className="opacity-70">ประมาณการ อิง {result.sampleCount} จุดข้อมูล</p>
        </div>
      )}
    </div>
  );
}
