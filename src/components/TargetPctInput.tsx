"use client";

import { useState, useTransition } from "react";
import { updateTargetPct } from "@/app/assets/actions";

export default function TargetPctInput({
  assetId,
  initialValue,
}: {
  assetId: string;
  initialValue: number | undefined;
}) {
  const [value, setValue] = useState(initialValue?.toString() ?? "");
  const [isPending, startTransition] = useTransition();

  function handleBlur() {
    const trimmed = value.trim();
    const num = trimmed === "" ? null : Number(trimmed);
    if (num !== null && !Number.isFinite(num)) return;
    startTransition(() => updateTargetPct(assetId, num));
  }

  return (
    <input
      type="number"
      step="any"
      min="0"
      max="100"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      disabled={isPending}
      placeholder="-"
      className="w-16 rounded border border-black/15 px-1.5 py-1 text-right text-xs disabled:opacity-50 dark:border-white/20 dark:bg-transparent"
    />
  );
}
