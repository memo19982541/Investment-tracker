"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Asset } from "@/lib/types";

export default function AssetFilter({ assets }: { assets: Asset[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = searchParams.get("assetId") ?? "";

  function handleChange(assetId: string) {
    const params = new URLSearchParams(searchParams);
    if (assetId) params.set("assetId", assetId);
    else params.delete("assetId");
    router.push(`?${params.toString()}`);
  }

  return (
    <label className="flex flex-col gap-1 text-sm">
      ดูแยกตามสินทรัพย์
      <select
        value={selected}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-md border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
      >
        <option value="">ทั้งหมด</option>
        {assets.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    </label>
  );
}
