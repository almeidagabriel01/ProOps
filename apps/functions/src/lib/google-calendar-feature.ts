function parseBooleanFlag(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;

  return ["1", "true", "yes", "on"].includes(normalized);
}

export function isGoogleCalendarSyncEnabled(): boolean {
  return parseBooleanFlag(process.env.GOOGLE_CALENDAR_SYNC_ENABLED, false);
}
