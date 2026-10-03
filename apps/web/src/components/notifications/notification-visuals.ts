import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  FileWarning,
  HardHat,
  ListTodo,
  MessageCircle,
  MessageSquareWarning,
  TrendingUp,
} from "lucide-react";
import { NotificationType } from "@/types/notification";

/** Ícone e cor de cada tipo: o sino e a central desenham igual. */
export function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case NotificationType.TRANSACTION_DUE_REMINDER:
      return Clock;
    case NotificationType.PROPOSAL_EXPIRING:
      return AlertTriangle;
    case NotificationType.PRICE_CHANGE:
      return TrendingUp;
    case NotificationType.PROPOSAL_FOLLOW_UP:
      return MessageCircle;
    case NotificationType.LEAD_REMINDER:
      return CalendarClock;
    case NotificationType.PROPOSAL_ACCEPTED:
      return CheckCircle2;
    case NotificationType.PROPOSAL_CHANGES_REQUESTED:
      return MessageSquareWarning;
    case NotificationType.PROJECT_DELIVERY_ACCEPTED:
      return HardHat;
    case NotificationType.TRANSACTION_PAID_ONLINE:
      return CheckCircle2;
    case NotificationType.TASK_ASSIGNED:
    case NotificationType.TASK_MENTIONED:
    case NotificationType.TASK_REMINDER:
    case NotificationType.TASK_UPDATED:
      return ListTodo;
    case NotificationType.BOOKING_REQUESTED:
    case NotificationType.PROJECT_VISIT_SCHEDULED:
      return CalendarClock;
    case NotificationType.SERVICE_ORDER_ASSIGNED:
      return ClipboardList;
    case NotificationType.SERVICE_CONTRACT_SUSPENDED:
      return FileWarning;
    default:
      return FileText;
  }
}

export function getNotificationIconClassName(type: NotificationType): string {
  switch (type) {
    case NotificationType.PRICE_CHANGE:
      return "bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400";
    case NotificationType.PROPOSAL_ACCEPTED:
      return "bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400";
    case NotificationType.PROPOSAL_CHANGES_REQUESTED:
    case NotificationType.SERVICE_CONTRACT_SUSPENDED:
      return "bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400";
    case NotificationType.PROJECT_DELIVERY_ACCEPTED:
    case NotificationType.TRANSACTION_PAID_ONLINE:
      return "bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400";
    case NotificationType.PROPOSAL_FOLLOW_UP:
      return "bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400";
    case NotificationType.LEAD_REMINDER:
      return "bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}
