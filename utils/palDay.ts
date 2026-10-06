/**
 * Palzee's day runs 04:00 -> 04:00 local time (same rule as the native Android app), and each
 * relative hour of that day holds at most one clip per user.
 */

export const DAY_START_HOUR = 4;

/** Local calendar date of the pal day an instant belongs to (an instant before 04:00 counts as yesterday). */
export function palDayOf(date: Date): Date {
  const d = new Date(date);
  if (d.getHours() < DAY_START_HOUR) d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Hour slot within the pal day: 0 at 04:00 ... 23 at 03:00. */
export function relativeHour(date: Date): number {
  return (date.getHours() - DAY_START_HOUR + 24) % 24;
}

/** [start, end) of the pal day `offset` days before today (0 = today). */
export function palDayRange(offset = 0, now = new Date()): { start: Date; end: Date } {
  const start = palDayOf(now);
  start.setDate(start.getDate() - offset);
  start.setHours(DAY_START_HOUR, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function isInPalDay(date: Date, offset = 0, now = new Date()): boolean {
  const { start, end } = palDayRange(offset, now);
  return date >= start && date < end;
}

/** Stable key like 2026-10-06 for grouping clips by pal day. */
export function palDayKey(date: Date): string {
  const d = palDayOf(date);
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** "7 PM" style label for an hour slot. */
export function hourLabel(date: Date): string {
  const h = date.getHours();
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 === 0 ? 12 : h % 12} ${suffix}`;
}
