"use client";

import { useMemo, useState } from "react";
import { createTransaction } from "@/app/transactions/actions";
import { sortAssetsForPicker } from "@/lib/assetPicker";
import { todayInThailand } from "@/lib/format";
import type { Asset } from "@/lib/types";

type AmountMode = "units" | "totalValue";

export default function TransactionForm({ assets: unsortedAssets }: { assets: Asset[] }) {
  const assets = useMemo(() => sortAssetsForPicker(unsortedAssets), [unsortedAssets]);
  const [assetId, setAssetId] = useState(assets[0]?.id ?? "");
  const [amountMode, setAmountMode] = useState<AmountMode>("units");
  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const selectedAsset = assetById.get(assetId);
  const isCash = selectedAsset?.type === "cash";
  const cashAssets = useMemo(
    () =>
      assets.filter(
        (a) => a.type === "cash" && !a.hidden && a.currency === selectedAsset?.currency
      ),
    [assets, selectedAsset?.currency]
  );
  const [useCash, setUseCash] = useState(false);
  const [cashAssetId, setCashAssetId] = useState("");
  const effectiveCashId = cashAssets.some((a) => a.id === cashAssetId)
    ? cashAssetId
    : (cashAssets[0]?.id ?? "");

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
      {!isCash && cashAssets.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-sm sm:col-span-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={useCash}
              onChange={(e) => setUseCash(e.target.checked)}
            />
            บันทึกเข้า/ออกจากเงินสดด้วย (ซื้อ = ตัดเงินสด, ขาย = เพิ่มเงินสด)
          </label>
          {useCash && (
            <select
              name="cashAssetId"
              value={effectiveCashId}
              onChange={(e) => setCashAssetId(e.target.value)}
              className="rounded-md border border-black/15 px-3 py-1.5 dark:border-white/20 dark:bg-transparent"
            >
              {cashAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
        </div>
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
