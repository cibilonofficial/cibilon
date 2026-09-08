/** Calendar-month boundaries in Asia/Kolkata, independent of the server timezone. */
export function comparisonPeriods(now = new Date()) {
  const offset = 330 * 60_000;
  const local = new Date(now.getTime() + offset);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  return {
    previousStart: new Date(Date.UTC(year, month - 1, 1) - offset),
    currentStart: new Date(Date.UTC(year, month, 1) - offset),
    asOf: now,
  };
}

export function compareMonths(current: number, previous: number) {
  return {
    current, previous,
    percent: previous === 0 ? (current === 0 ? 0 : null) : Math.round((current - previous) / previous * 1000) / 10,
  };
}
