import type { ReactNode } from "react";
import Image from "next/image";
import { formatMoney } from "@/lib/format";
import { imageTier, type DailyTier } from "@/lib/cheer";

/** Goals the bar steps through automatically: it targets the first one not yet reached. */
const GOALS_THB = [1_000_000, 2_000_000, 5_000_000, 10_000_000];
const MILESTONES = [25, 50, 75];

function goalFor(value: number): { goal: number; previousGoal: number | null } {
  const idx = GOALS_THB.findIndex((g) => value < g);
  const i = idx === -1 ? GOALS_THB.length - 1 : idx;
  return { goal: GOALS_THB[i], previousGoal: i > 0 ? GOALS_THB[i - 1] : null };
}

function millions(n: number): string {
  return `${n / 1_000_000} ล้านบาท`;
}

function cheer(pct: number, goal: number, previousGoal: number | null): string {
  if (pct >= 100) return `ถึงเป้า ${millions(goal)}แล้ว! เก่งที่สุดเลย`;
  if (pct >= 75) return "เหลืออีกนิดเดียวแล้ว สู้ๆ!";
  if (pct >= 50) return "ผ่านครึ่งทางแล้ว! ทำได้ดีมากเลย";
  if (pct >= 25) return "ผ่านไปหนึ่งส่วนสี่แล้ว เดินหน้าต่อไปเรื่อยๆ นะ";
  if (previousGoal) return `ผ่านเป้า ${millions(previousGoal)}แล้ว! ก้าวต่อไปคือ ${millions(goal)} สู้ๆ`;
  return "ทุกบาทที่สะสมคือก้าวไปสู่เป้าหมาย สู้ๆ นะ!";
}

/** Compact progress toward the next goal (1 / 2 / 5 / 10 million THB), meant for the baht portfolio's header. */
export function GoalProgressBar({
  value,
  action,
}: {
  value: number;
  /** Optional control shown at the right end of the caption line under the bar. */
  action?: ReactNode;
}) {
  const { goal, previousGoal } = goalFor(value);
  const pct = Math.max(0, (value / goal) * 100);
  const barPct = Math.min(100, pct);
  const remaining = Math.max(0, goal - value);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div
          role="progressbar"
          aria-label={`ความคืบหน้าสู่เป้า ${formatMoney(goal)} บาท`}
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
          เป้า {formatMoney(goal)}
          {remaining > 0 && <> · ขาดอีก {formatMoney(remaining)}</>} ·{" "}
          <span className="font-medium text-pink-600 dark:text-pink-400">
            {cheer(pct, goal, previousGoal)}
          </span>
        </p>
        {action}
      </div>
    </div>
  );
}

// Each image is a transparent bust cut-out already shrunk to web size.
const IMAGE_SIZE: Record<Exclude<DailyTier, "none">, { width: number; height: number }> = {
  surge: { width: 388, height: 360 },
  up: { width: 425, height: 360 },
  flat: { width: 425, height: 360 },
  down: { width: 425, height: 360 },
  drop: { width: 425, height: 360 },
  plunge: { width: 396, height: 360 },
};

/**
 * The cheering character at the right end of the baht portfolio's header.
 * The bust shots are cut off at the waist so she looks like she's standing
 * behind the progress bar directly beneath her.
 */
export function CheerBust({ tier }: { tier: DailyTier }) {
  const name = imageTier(tier);
  const size = IMAGE_SIZE[name];
  return (
    <Image
      src={`/investor-${name}.png`}
      alt=""
      width={size.width}
      height={size.height}
      // Already web-sized; skipping the optimizer also keeps the file behind
      // the login (the optimizer fetches it server-side without the session
      // cookie, which the auth proxy would redirect to /login).
      unoptimized
      className="pointer-events-none h-[120px] w-auto shrink-0 select-none sm:h-44"
    />
  );
}
