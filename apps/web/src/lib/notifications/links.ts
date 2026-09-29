import type { Notification } from "@/types/notification";

/**
 * Tela que resolve a notificação. O sino, a central e o e-mail levam ao mesmo
 * lugar; a versão do backend (`notificationLinkPath`) é conferida contra esta
 * em `notification-catalog-parity.test.ts`.
 */
export function notificationLinkPath(
  n: Pick<
    Notification,
    | "type"
    | "proposalId"
    | "transactionId"
    | "leadId"
    | "clientId"
    | "projectId"
    | "taskId"
    | "bookingRequestId"
    | "serviceOrderId"
  >,
): string {
  switch (n.type) {
    case "transaction_due_reminder":
    case "transaction_viewed":
    case "transaction_paid_online":
      return "/transactions";
    case "lead_reminder":
      if (n.leadId) return `/crm?tab=leads&lead=${n.leadId}`;
      return n.clientId ? `/contacts/${n.clientId}` : "/crm?tab=leads";
    case "proposal_accepted":
      // Abre a lista já com o aceite na tela: é ali que ficam o confirmar
      // (que gera o financeiro e convida a emitir a nota) e o ajustar.
      return n.proposalId ? `/proposals?aceite=${n.proposalId}` : "/proposals";
    case "proposal_changes_requested":
      return n.proposalId ? `/proposals?ajuste=${n.proposalId}` : "/proposals";
    case "project_delivery_accepted":
    case "project_visit_scheduled":
      return n.projectId ? `/projects/${n.projectId}` : "/projects";
    case "task_assigned":
    case "task_mentioned":
    case "task_reminder":
    case "task_updated":
      return n.taskId ? `/tasks?task=${n.taskId}` : "/tasks";
    case "booking_requested":
      return n.bookingRequestId ? `/calendar?pedido=${n.bookingRequestId}` : "/calendar";
    case "service_order_assigned":
      return n.serviceOrderId ? `/service-orders/${n.serviceOrderId}` : "/service-orders";
    default:
      return n.proposalId ? `/proposals/${n.proposalId}/view` : "/notifications";
  }
}
