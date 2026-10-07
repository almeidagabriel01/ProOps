/**
 * Espelho dos rótulos do histórico da equipe
 * (`apps/functions/src/shared/member-audit-catalog.ts`). A paridade é cobrada
 * por `__tests__/member-audit-labels-parity.test.ts`: ação nova no backend
 * sem rótulo aqui reprova.
 */
export const MEMBER_AUDIT_LABELS = {
  proposal_approved: "Aprovou uma proposta",
  proposal_reverted: "Tirou uma proposta de aprovada",
  proposal_deleted: "Excluiu uma proposta",
  transaction_settled: "Deu baixa num lançamento",
  transaction_reverted: "Estornou um lançamento pago",
  transaction_deleted: "Excluiu um lançamento",
  wallet_transfer: "Transferiu entre carteiras",
  wallet_adjusted: "Ajustou o saldo de uma carteira",
  wallet_deleted: "Excluiu uma carteira",
  invoice_canceled: "Cancelou uma nota fiscal",
  invoice_corrected: "Emitiu uma carta de correção",
  contract_activated: "Ativou um contrato",
  contract_ended: "Encerrou um contrato",
  service_order_reopened: "Reabriu uma ordem de serviço",
  client_deleted: "Excluiu um contato",
  product_deleted: "Excluiu um produto",
  data_exported: "Exportou uma planilha",
  member_created: "Criou um membro",
  member_permissions_changed: "Mudou as permissões de um membro",
  member_suspended: "Suspendeu um membro",
  member_reactivated: "Reativou um membro",
  member_sessions_revoked: "Encerrou as sessões de um membro",
  member_deleted: "Excluiu um membro",
} as const;

export type MemberAuditAction = keyof typeof MEMBER_AUDIT_LABELS;

export function memberAuditLabel(action: string): string {
  return (MEMBER_AUDIT_LABELS as Record<string, string>)[action] ?? action;
}
