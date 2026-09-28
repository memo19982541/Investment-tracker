"use client";

import { useMemo, useState } from "react";
import { createTransaction } from "@/app/transactions/actions";
import { todayInThailand } from "@/lib/format";
import type { Asset } from "@/lib/types";

type AmountMode = "units" | "totalValue";

export default function TransactionForm({ assets }: { assets: Asset[] }) {
  const [assetId, setAssetId] = useState(assets[0]?.id ?? "");
  const [amountMode, setAmountMode] = useState<AmountMode>("units");
  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const isCash = assetById.get(assetId)?.type === "cash";

  return (
    <form
      action={createTransaction}
      className="grid grid-cols-1 gap-3 rounded-lg border border-black/10 p-4 sm:grid-cols-2 dark:border-white/10"
    >
      <label className="flex flex-col gap-1 text-sm">
        สินทรัพย์
        <select
          name="assetId"
          required
          value={assetId}
          onChange={(e) => setAssetId(e.target.value)}
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
        >
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        ประเภทธุรกรรม
        <select
          name="type"
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
        >
          <option value="buy">{isCash ? "ฝากเข้า" : "ซื้อ"}</option>
          <option value="sell">{isCash ? "ถอนออก" : "ขาย"}</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        วันที่
        <input
          type="date"
          name="date"
          required
          defaultValue={todayInThailand()}
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
        />
      </label>
      {isCash ? (
        <label className="flex flex-col gap-1 text-sm">
          จำนวนเงิน
          <input
            type="number"
            step="any"
            name="units"
            required
            className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
          />
        </label>
      ) : (
        <label className="flex flex-col gap-1 text-sm">
          กรอกโดย
          <select
            value={amountMode}
            onChange={(e) => setAmountMode(e.target.value as AmountMode)}
            className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
          >
            <option value="units">จำนวนหน่วย</option>
            <option value="totalValue">มูลค่ารวม (บาท)</option>
          </select>
        </label>
      )}
      {isCash ? (
        <input type="hidden" name="pricePerUnit" value="1" />
      ) : (
        <>
          {amountMode === "units" ? (
            <label className="flex flex-col gap-1 text-sm">
              จำนวนหน่วย
              <input
                type="number"
                step="any"
                name="units"
                required
                className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
              />
            </label>
          ) : (
            <label className="flex flex-col gap-1 text-sm">
              มูลค่ารวม (บาท)
              <input
                type="number"
                step="any"
                name="totalValue"
                required
                placeholder="เช่น broker แจ้งแค่ยอดเงิน ไม่บอกจำนวนหน่วย"
                className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
              />
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm">
            ราคา/NAV ต่อหน่วย
            <input
              type="number"
              step="any"
              name="pricePerUnit"
              required
              className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
            />
          </label>
        </>
      )}
      <label className="flex flex-col gap-1 text-sm">
        หมายเหตุ (ถ้ามี)
        <input
          name="note"
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
        />
      </label>
      <button
        type="submit"
        className="sm:col-span-2 rounded-md bg-black py-2.5 font-medium text-white dark:bg-white dark:text-black"
      >
        บันทึกธุรกรรม
      </button>
    </form>
  );
}
