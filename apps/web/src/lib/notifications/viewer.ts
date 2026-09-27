import type { Notification } from "@/types/notification";
import type { NotificationScope } from "@/lib/notifications/scope";

/**
 * Como a pessoa enxerga as notificações.
 *
 * - `recipient`: o caso normal. Vê só o que foi endereçado a ela
 *   (`recipientUids`) e lê por conta própria (`readBy`).
 * - `company`: o superadmin, no escopo do sistema ou vendo uma empresa pelo
 *   painel. Vê tudo e usa a leitura da empresa (`isRead`).
 * - `demo`: a conta free, que lê as notificações de exemplo do tenant `demo`,
 *   só leitura.
 */
export type NotificationViewerMode = "recipient" | "company" | "demo";

export interface NotificationViewer {
  uid: string;
  mode: NotificationViewerMode;
  /** Só no modo `demo`: o tenant de demonstração do nicho da conta. */
  demoTenantId?: string;
}

export const DEMO_NOTIFICATION_TENANT_ID = "demo";

export function resolveNotificationViewer(input: {
  uid: string | null | undefined;
  role: string | null | undefined;
  scope: NotificationScope | null;
  /** Tenant de demonstração que a conta free navega (o do nicho dela). */
  demoTenantId?: string | null;
}): NotificationViewer | null {
  if (!input.uid || !input.scope) return null;
  const role = String(input.role || "").trim().toLowerCase();
  if (role === "superadmin" || input.scope.kind === "system") {
    return { uid: input.uid, mode: "company" };
  }
  if (role === "free") {
    return {
      uid: input.uid,
      mode: "demo",
      demoTenantId: input.demoTenantId || DEMO_NOTIFICATION_TENANT_ID,
    };
  }
  return { uid: input.uid, mode: "recipient" };
}

export function isNotificationRead(
  notification: Pick<Notification, "isRead" | "readBy">,
  viewer: NotificationViewer | null,
): boolean {
  if (viewer?.mode === "recipient" && Array.isArray(notification.readBy)) {
    return notification.readBy.includes(viewer.uid);
  }
  return notification.isRead === true;
}

/** A mesma notificação, marcada como lida para quem está olhando. */
export function markReadFor<T extends Pick<Notification, "isRead" | "readBy">>(
  notification: T,
  viewer: NotificationViewer | null,
): T {
  if (viewer?.mode === "recipient") {
    const readBy = notification.readBy ?? [];
    return readBy.includes(viewer.uid)
      ? notification
      : { ...notification, readBy: [...readBy, viewer.uid] };
  }
  return { ...notification, isRead: true };
}
