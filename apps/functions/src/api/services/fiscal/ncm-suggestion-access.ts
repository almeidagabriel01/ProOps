import { hasPagePermission } from "../../../lib/auth-helpers";

/**
 * A sugestão de NCM por IA gasta a cota de IA da empresa e aparece no
 * cadastro de produto e de serviço e na emissão de nota. Pede quem cadastra
 * (criar ou editar Produtos ou Serviços) ou quem emite (criar em Notas
 * Fiscais). Até 2026-10 qualquer pessoa da empresa a chamava.
 */
export async function canRequestNcmSuggestion(
  claims: Parameters<typeof hasPagePermission>[0],
): Promise<boolean> {
  const checks: Array<[string, "canCreate" | "canEdit"]> = [
    ["products", "canCreate"],
    ["products", "canEdit"],
    ["services", "canCreate"],
    ["services", "canEdit"],
    ["invoices", "canCreate"],
  ];
  for (const [pageId, action] of checks) {
    if (await hasPagePermission(claims, pageId, action)) return true;
  }
  return false;
}
