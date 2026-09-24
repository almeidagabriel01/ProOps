function parseBooleanFlag(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;

  return ["1", "true", "yes", "on"].includes(normalized);
}

export function isGoogleCalendarSyncEnabled(): boolean {
  return parseBooleanFlag(process.env.GOOGLE_CALENDAR_SYNC_ENABLED, false);
}

/**
 * Marca de um consentimento antigo, concedido antes de um escopo ser
 * adicionado.
 *
 * Sem isso a UI mostra "Request had insufficient authentication scopes", que
 * não diz nada a quem instala cortina. O que resolve é reconectar, e é isso que
 * a mensagem precisa dizer.
 */
export function isInsufficientScopeError(message: string): boolean {
  return /insufficient authentication scopes|insufficient_scope/i.test(message);
}

/** Mensagem acionável para o erro que só a reconexão resolve. */
export const RECONNECT_REQUIRED_MESSAGE =
  "A permissão concedida ao Google Agenda está desatualizada. Clique em Reconectar para autorizar a leitura dos seus eventos.";
