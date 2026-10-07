"use client";

import { useTransition } from "react";
import { setAssetPaysDividend } from "@/app/assets/actions";

/** Orange dot = pays dividends; a faint hollow dot (still clickable) = does not. */
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

  const label = paysDividend ? "จ่ายปันผล (กดเพื่อเปลี่ยน)" : "ไม่จ่ายปันผล (กดเพื่อเปลี่ยน)";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      title={label}
      aria-label={label}
      className="inline-flex h-5 w-5 items-center justify-center disabled:opacity-50"
    >
      <span
        className={`h-3 w-3 rounded-full ${
          paysDividend
            ? "bg-amber-500"
            : "border border-black/20 dark:border-white/25"
        }`}
      />
    </button>
  );
}
