"use client";

import { useTransition } from "react";
import { setAssetHidden } from "@/app/assets/actions";

export default function HideAssetToggle({
  assetId,
  hidden,
}: {
  assetId: string;
  hidden: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(() => setAssetHidden(assetId, !hidden));
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="whitespace-nowrap text-xs text-black/60 hover:underline disabled:opacity-50 dark:text-white/60"
    >
      {hidden ? "แสดง" : "ซ่อน"}
    </button>
  );
}
