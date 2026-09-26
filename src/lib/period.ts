export type Period = "1m" | "3m" | "6m" | "1y" | "all";

export const PERIOD_LABELS: Record<Period, string> = {
  "1m": "1 เดือน",
  "3m": "3 เดือน",
  "6m": "6 เดือน",
  "1y": "1 ปี",
  all: "ตั้งแต่ต้น",
};

/** Cutoff date (YYYY-MM-DD) for a period, or null for "all" (no cutoff). */
export function cutoffDateFor(period: Period): string | null {
  if (period === "all") return null;
  const months = { "1m": 1, "3m": 3, "6m": 6, "1y": 12 }[period];
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}
