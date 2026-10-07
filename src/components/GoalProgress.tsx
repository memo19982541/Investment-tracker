import type { ReactNode } from "react";
import Image from "next/image";
import { formatMoney } from "@/lib/format";

const GOAL_THB = 2_000_000;
const MILESTONES = [25, 50, 75];

function cheer(pct: number): string {
  if (pct >= 100) return "ถึงเป้า 2 ล้านบาทแล้ว! เก่งที่สุดเลย";
  if (pct >= 75) return "เหลืออีกนิดเดียวแล้ว สู้ๆ!";
  if (pct >= 50) return "ผ่านครึ่งทางแล้ว! ทำได้ดีมากเลย";
  if (pct >= 25) return "ผ่านไปหนึ่งส่วนสี่แล้ว เดินหน้าต่อไปเรื่อยๆ นะ";
  return "ทุกบาทที่สะสมคือก้าวไปสู่เป้าหมาย สู้ๆ นะ!";
}

/** Compact progress toward the 2,000,000 THB goal, meant for the baht portfolio's header. */
export function GoalProgressBar({
  value,
  action,
}: {
  value: number;
  /** Optional control shown at the right end of the caption line under the bar. */
  action?: ReactNode;
}) {
  const pct = Math.max(0, (value / GOAL_THB) * 100);
  const barPct = Math.min(100, pct);
  const remaining = Math.max(0, GOAL_THB - value);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div
          role="progressbar"
          aria-label={`ความคืบหน้าสู่เป้า ${formatMoney(GOAL_THB)} บาท`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(barPct)}
          className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/15"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-pink-400 to-amber-400"
            style={{ width: `${barPct}%` }}
          />
          {MILESTONES.map((m) => (
            <span
              key={m}
              className="absolute top-0 h-full w-px bg-white/80 dark:bg-black/40"
              style={{ left: `${m}%` }}
            />
          ))}
        </div>
        <span className="text-sm font-semibold tabular-nums">{pct.toFixed(1)}%</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-xs text-black/60 dark:text-white/60">
          เป้า {formatMoney(GOAL_THB)}
          {remaining > 0 && <> · ขาดอีก {formatMoney(remaining)}</>} ·{" "}
          <span className="font-medium text-pink-600 dark:text-pink-400">{cheer(pct)}</span>
        </p>
        {action}
      </div>
    </div>
  );
}

/**
 * The cheering character, cut off at the waist so she looks like she's
 * standing behind the progress bar directly beneath her — meant to sit at the
 * right end of the baht portfolio's header, bottom-aligned with its text.
 */
export function CheerBust() {
  return (
    <Image
      src="/investor-bust.png"
      alt=""
      width={480}
      height={406}
      // Already web-sized; skipping the optimizer also keeps the file behind
      // the login (the optimizer fetches it server-side without the session
      // cookie, which the auth proxy would redirect to /login).
      unoptimized
      className="pointer-events-none h-auto w-36 shrink-0 select-none sm:w-52"
    />
  );
}
