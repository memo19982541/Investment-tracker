"use client";

import { useTransition } from "react";
import { setAssetPaysDividend } from "@/app/assets/actions";

export default function PaysDividendToggle({
  assetId,
  paysDividend,
}: {
  assetId: string;
  paysDividend: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(() => setAssetPaysDividend(assetId, !paysDividend));
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`whitespace-nowrap text-xs hover:underline disabled:opacity-50 ${
        paysDividend
          ? "text-amber-600 dark:text-amber-500"
          : "text-black/60 dark:text-white/60"
      }`}
    >
      {paysDividend ? "จ่ายปันผล" : "ไม่จ่ายปันผล"}
    </button>
  );
}
