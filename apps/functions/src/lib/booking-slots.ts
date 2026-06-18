export const WORK_START_MIN = 9 * 60; // 540
export const WORK_END_MIN = 17 * 60; // 1020
export const VALID_DURATIONS = [15, 30, 60] as const;

export interface BookedInterval {
  startMinutes: number;
  endMinutes: number;
}

export function intervalsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function isValidDuration(d: number): d is 15 | 30 | 60 {
  return (VALID_DURATIONS as readonly number[]).includes(d);
}

export function isValidSlotStart(
  startMinutes: number,
  duration: number,
): boolean {
  if (!isValidDuration(duration)) return false;
  if (startMinutes < WORK_START_MIN) return false;
  if (startMinutes + duration > WORK_END_MIN) return false;
  return (startMinutes - WORK_START_MIN) % duration === 0;
}

export function hasConflict(
  startMinutes: number,
  duration: number,
  existing: BookedInterval[],
): boolean {
  const end = startMinutes + duration;
  return existing.some((b) =>
    intervalsOverlap(startMinutes, end, b.startMinutes, b.endMinutes),
  );
}
