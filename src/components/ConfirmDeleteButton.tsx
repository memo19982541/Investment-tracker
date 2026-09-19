"use client";

import { useEffect, useRef, useState, useTransition } from "react";

const CONFIRM_TIMEOUT_MS = 6000;

/**
 * A "ลบ" button that requires a second click within a few seconds to
 * actually fire — avoids relying on window.confirm(), which browser
 * automation/some environments silently suppress (confirm() returns false
 * without ever showing a dialog), making native-dialog-based delete buttons
 * appear to do nothing.
 */
export default function ConfirmDeleteButton({
  onConfirm,
  title,
}: {
  onConfirm: () => void | Promise<void>;
  title?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function handleClick() {
    if (!confirming) {
      setConfirming(true);
      timeoutRef.current = setTimeout(() => setConfirming(false), CONFIRM_TIMEOUT_MS);
      return;
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    startTransition(() => onConfirm());
  }

  if (confirming) {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        title={title}
        className="whitespace-nowrap rounded bg-red-600 px-2 py-0.5 text-xs font-medium text-white disabled:opacity-50"
      >
        {isPending ? "กำลังลบ..." : "ยืนยันลบ?"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-xs text-red-600 hover:underline"
    >
      ลบ
    </button>
  );
}
