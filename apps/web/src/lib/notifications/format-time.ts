import { formatDateBR } from "@/utils/date-format";

/** "agora", "há 5min", "há 3h", "há 2d" ou a data, para o sino e a central. */
export function formatNotificationTime(timestamp: string, now: Date = new Date()): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "agora";
  if (diffMins < 60) return `há ${diffMins}min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  if (diffDays < 7) return `há ${diffDays}d`;
  return formatDateBR(date);
}
