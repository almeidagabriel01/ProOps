/**
 * O que entra no histórico de ações da equipe (`member_audit`), lido pelo dono
 * e pelos administradores na aba Histórico de /settings/team. Catálogo
 * FECHADO: ação fora daqui não é gravada, e o rótulo de cada uma é o que a
 * tela mostra. Puro, sem import: o front espelha os rótulos.
 *
 * O alvo leva tipo, id e um rótulo curto (título da proposta, descrição do
 * lançamento, nome do contato); nunca CPF, telefone ou e-mail.
 */

export const MEMBER_AUDIT_ACTIONS = {
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

export type MemberAuditAction = keyof typeof MEMBER_AUDIT_ACTIONS;

export const MEMBER_AUDIT_TARGET_TYPES = [
  "proposal",
  "transaction",
  "wallet",
  "invoice",
  "contract",
  "service_order",
  "client",
  "product",
  "export",
  "member",
] as const;

export type MemberAuditTargetType = (typeof MEMBER_AUDIT_TARGET_TYPES)[number];

/** Ações que o navegador pode registrar por `POST /v1/audit/events`: só a exportação, que acontece nele. */
export const CLIENT_REPORTED_AUDIT_ACTIONS: readonly MemberAuditAction[] = ["data_exported"];

/** Quanto tempo o histórico fica (TTL do Firestore pelo `expiresAt`). */
export const MEMBER_AUDIT_RETENTION_DAYS = 365;

export function isMemberAuditAction(value: unknown): value is MemberAuditAction {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(MEMBER_AUDIT_ACTIONS, value);
}
