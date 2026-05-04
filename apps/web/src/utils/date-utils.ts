/**
 * Utility functions for date manipulation
 */

/**
 * Calculates the difference in years, months, and days between two dates.
 * Note: This is a simplified diff for shifting purposes.
 */
export function calculateDateDiff(from: Date, to: Date) {
  return {
    yearData: to.getFullYear() - from.getFullYear(),
    monthData: to.getMonth() - from.getMonth(),
    dayData: to.getDate() - from.getDate(),
  };
}

/**
 * Applies a calculated date difference to a base date.
 * Handles month overflows by letting Date object normalize (e.g. Jan 32 -> Feb 1).
 */
export function applyDateDiff(
  baseDate: Date,
  diff: { yearData: number; monthData: number; dayData: number }
): Date {
  const newDate = new Date(baseDate);

  // Apply changes
  newDate.setFullYear(newDate.getFullYear() + diff.yearData);
  newDate.setMonth(newDate.getMonth() + diff.monthData);
  newDate.setDate(newDate.getDate() + diff.dayData);

  return newDate;
}

/**
 * Parses a YYYY-MM-DD string into a Date object in local time
 * (treating the string as local midnight, not UTC).
 */
export function parseLocalDate(dateString: string): Date {
  if (!dateString) return new Date();

  // Handle ISO strings with time
  const part = dateString.includes("T") ? dateString.split("T")[0] : dateString;
  const [year, month, day] = part.split("-").map(Number);

  // Note: Month is 0-indexed in Date constructor
  return new Date(year, month - 1, day);
}

/**
 * Formats a Date object to YYYY-MM-DD string
 */
export function toISODateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Returns the current date in YYYY-MM-DD format using local time.
 * This avoids issues where usage of toISOString() (UTC) returns the next day
 * in late evening hours for western timezones.
 */
export function getTodayISO(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Shifts a target date based on the difference between an original date and a new date.
 * Safe for YYYY-MM-DD strings.
 */
export function shiftDateByTransform(
  targetDateStr: string,
  originalRefDateStr: string,
  newRefDateStr: string
): string {
  if (!targetDateStr || !originalRefDateStr || !newRefDateStr)
    return targetDateStr;

  const target = parseLocalDate(targetDateStr);
  const original = parseLocalDate(originalRefDateStr);
  const current = parseLocalDate(newRefDateStr);

  const diff = calculateDateDiff(original, current);
  const shifted = applyDateDiff(target, diff);

  return toISODateString(shifted);
}
