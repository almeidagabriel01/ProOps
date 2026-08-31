/**
 * Resolves which provider serves a tenant.
 *
 * Today there is exactly one implementation. The registry exists anyway
 * because the alternative — importing `focusFiscalProvider` from domain code —
 * is what makes a provider migration expensive, and fiscal providers do
 * disappear (Nuvem Fiscal, 31/07/2026).
 */

import { focusFiscalProvider } from "./focus.provider";
import type { FiscalProvider, FiscalProviderId } from "./fiscal-provider";
import type { FiscalEnvironment } from "./fiscal-types";

const PROVIDERS: Partial<Record<FiscalProviderId, FiscalProvider>> = {
  focus: focusFiscalProvider,
};

export const DEFAULT_FISCAL_PROVIDER_ID: FiscalProviderId = "focus";

/**
 * @throws when the id has no implementation registered — a tenant pointing at
 * a provider we removed must fail loudly, not fall back to another one and
 * issue documents through the wrong account.
 */
export function getFiscalProvider(
  providerId: FiscalProviderId = DEFAULT_FISCAL_PROVIDER_ID,
): FiscalProvider {
  const provider = PROVIDERS[providerId];
  if (!provider) {
    throw new Error(`FISCAL_PROVIDER_NAO_SUPORTADO: ${providerId}`);
  }
  return provider;
}

/**
 * Which Focus environment to talk to.
 *
 * Production is opt-in per tenant: a tenant is only promoted after a test
 * document is authorized in homologação. Defaulting to homologação means a
 * misconfiguration produces a document with no fiscal effect instead of a real
 * one that has to be cancelled.
 */
export function resolveFiscalEnvironment(
  tenantEnvironment: string | undefined,
): FiscalEnvironment {
  return String(tenantEnvironment || "").trim() === "producao"
    ? "producao"
    : "homologacao";
}
