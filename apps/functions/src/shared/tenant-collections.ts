/**
 * Onde moram os dados de uma empresa: fonte unica para a exclusao definitiva
 * ("Excluir definitivamente" no painel do superadmin).
 *
 * A exclusao antiga tinha a propria lista, escrita a mao, e ela parou no tempo:
 * CRM, agenda, fiscal, Drive, WhatsApp, fila de payout e grupos de lancamento
 * nasceram depois e ficavam para tras. Aqui TODA colecao de primeiro nivel das
 * rules precisa estar em exatamente uma das listas abaixo; o teste
 * `__tests__/tenant-collections.test.ts` le `firebase/firestore.rules` e falha
 * se aparecer uma colecao nova sem classificacao.
 */

/** Apagadas por `where("tenantId", "==", id)`. */
export const TENANT_PURGE_BY_FIELD = [
  "proposals",
  "clients",
  "products",
  "services",
  "transactions",
  "transaction_groups",
  "wallets",
  "wallet_transactions",
  "wallet_cascade_jobs",
  "sistemas",
  "ambientes",
  "proposal_templates",
  "custom_fields",
  "custom_options",
  "options",
  "addons",
  "purchased_addons",
  "kanban_statuses",
  "calendar_events",
  "calendar_integrations",
  "shared_proposals",
  "shared_transactions",
  "spreadsheets",
  "notifications",
  "whatsappLogs",
  "payout_attempts",
  "drive_delivery_jobs",
  "ai_traces",
] as const;

/** Um documento por empresa, com o id da empresa (subcolecoes incluidas). */
export const TENANT_PURGE_BY_DOC_ID = [
  "companies",
  "google_drive_integrations",
  "proposal_counters",
  "fiscal_settings",
  "received_invoice_cursors",
  "whatsappUsage",
  "tenant_usage",
  "tenant_presence",
] as const;

/**
 * Preservadas na exclusao definitiva.
 *
 * - Notas fiscais: guarda legal de 5 anos + ano corrente (Ajuste SINIEF
 *   07/2005), junto com o arquivo em `tenants/{id}/fiscal/` no Storage.
 * - `tenants`: fica um documento residual marcado `purged`, com o nome e o
 *   prazo de retencao; e ele que impede o webhook do Stripe de recriar a
 *   empresa como "zumbi".
 * - Auditoria de seguranca: rastro do que o superadmin fez, inclusive a
 *   propria exclusao.
 */
export const TENANT_PRESERVED = [
  "invoices",
  "received_invoices",
  "tenants",
  "security_audit_events",
] as const;

/**
 * Nao pertencem a uma empresa (ou sao limpas por outro caminho):
 * - `users`: apagados um a um, com Auth, permissoes e indice de telefone;
 * - `phoneNumberIndex`: vai junto com o usuario;
 * - o resto e global, efemero (estados de OAuth, sessoes, rate limit) ou
 *   metrica/observabilidade da plataforma.
 */
export const NOT_TENANT_SCOPED = [
  "users",
  "phoneNumberIndex",
  "plans",
  "pages",
  "whatsappSessions",
  "whatsappRateLimit",
  "stripe_events",
  "email_audit",
  "calendar_oauth_states",
  "drive_oauth_states",
  "error_issues",
  "error_metrics",
  "security_metrics",
  "security_metrics_tenants",
  "mfaOtpChallenges",
  "mfaRecoveryCodes",
  "demo_bookings",
  // O proprio job de exclusao: fica para registrar que a empresa foi apagada.
  "tenant_purge_jobs",
] as const;

/** Pasta do Storage que sobrevive a exclusao definitiva. */
export function isPreservedStoragePath(tenantId: string, path: string): boolean {
  return path.startsWith(`tenants/${tenantId}/fiscal/`);
}

/**
 * Ate quando o arquivo fiscal precisa ser guardado: 5 anos completos contados
 * a partir do fim do ano corrente.
 */
export function fiscalRetentionUntil(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear() + 6, 0, 1)).toISOString();
}
