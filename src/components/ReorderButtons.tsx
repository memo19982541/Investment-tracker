"use client";

import { useTransition } from "react";
import { moveAssetOrder } from "@/app/assets/actions";

export default function ReorderButtons({
  assetId,
  isFirst,
  isLast,
}: {
  assetId: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        disabled={isFirst || isPending}
        onClick={() => startTransition(() => moveAssetOrder(assetId, "up"))}
        className="leading-none text-black/50 hover:text-black disabled:opacity-25 dark:text-white/50 dark:hover:text-white"
        aria-label="เลื่อนขึ้น"
      >
        ▲
      </button>
      <button
        type="button"
        disabled={isLast || isPending}
        onClick={() => startTransition(() => moveAssetOrder(assetId, "down"))}
        className="leading-none text-black/50 hover:text-black disabled:opacity-25 dark:text-white/50 dark:hover:text-white"
        aria-label="เลื่อนลง"
      >
        ▼
      </button>
    </div>
  );
}
