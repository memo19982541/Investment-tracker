export function formatMoney(n: number) {
  return n.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatUnits(n: number) {
  return n.toLocaleString("th-TH", { maximumFractionDigits: 4 });
}

export function formatDate(iso: string) {
  if (!iso) return "";

  // Plain "YYYY-MM-DD" dates (transactions, snapshots, NAV dates, …) carry
  // no time/timezone — parsing them with `new Date(iso)` reads them as UTC
  // midnight, which then renders as the PREVIOUS calendar day in any
  // timezone behind UTC. Build the Date from local components instead so
  // the displayed day never depends on the viewer's timezone.
  const dateOnly = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const d = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(iso);

  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Picks up to `maxTicks` evenly-spaced values from an already-sorted array
 * (always including the first and last), for passing as a chart axis's
 * explicit `ticks` prop. Recharts' own automatic tick selection can assign
 * the wrong label to a sparse category axis's tick positions once there are
 * many points with gaps (e.g. daily NAV history skipping weekends) — picking
 * the values ourselves, directly from data we already know is in order,
 * sidesteps that entirely.
 */
export function pickEvenTicks<T>(sorted: T[], maxTicks = 6): T[] {
  if (sorted.length <= maxTicks) return sorted;
  const step = (sorted.length - 1) / (maxTicks - 1);
  const picked: T[] = [];
  for (let i = 0; i < maxTicks; i++) {
    picked.push(sorted[Math.round(i * step)]);
  }
  return picked;
}
