import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";
import { isSubscriptionBlocked } from "@/lib/auth/subscription-blocked-statuses";
import { contractDayLabel } from "@/lib/billing/billing-banner";
import type { BlockedScreenInput } from "@/lib/billing/blocked-screen";
import { resolveBlockedSessionIdentity } from "@/lib/billing/blocked-session-identity";

const TENANT_ADMIN_ROLES = new Set(["MASTER", "ADMIN", "WK"]);

export interface BlockedSession {
  /** Para onde mandar quem não está bloqueado; null = mostrar a tela. */
  redirectTo: string | null;
  screen: BlockedScreenInput;
}

const NO_SESSION: BlockedScreenInput = {
  hasSession: false,
  isTenantAdmin: false,
  billing: "manual",
  status: "",
  periodEndLabel: null,
  tenantName: null,
  ownerName: null,
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Lê a sessão e o tenant uma vez por request (`cache`): o layout decide se
 * redireciona, e a página usa o mesmo contexto para escrever a mensagem.
 *
 * Sessão revogada ou vencida também mostra a tela (genérica): é o caminho
 * esperado para quem foi bloqueado com o navegador aberto.
 */
export const loadBlockedSession = cache(async (): Promise<BlockedSession> => {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("__session")?.value;
  if (!sessionCookie) return { redirectTo: null, screen: NO_SESSION };

  try {
    // checkRevoked: false — sessão revogada é esperada aqui.
    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, false);
    const db = getAdminFirestore();
    // O doc vence as claims: é ele que o login e o guard leem para mandar a
    // pessoa até aqui (ver lib/billing/blocked-session-identity.ts).
    const userData = (await db.collection("users").doc(decoded.uid).get()).data() ?? null;
    const { role, tenantId, masterId, isSuperAdmin } = resolveBlockedSessionIdentity(decoded, userData);

    if (isSuperAdmin) {
      return { redirectTo: "/admin", screen: NO_SESSION };
    }
    // Conta free não tem assinatura para estar bloqueada.
    if (role === "FREE") return { redirectTo: "/", screen: NO_SESSION };

    if (!tenantId) return { redirectTo: "/", screen: NO_SESSION };

    // Firestore e não as claims: elas podem estar velhas depois do webhook.
    const tenantData = (await db.collection("tenants").doc(tenantId).get()).data() as
      | Record<string, unknown>
      | undefined;
    const status = text(tenantData?.subscriptionStatus).toLowerCase();
    const pastDueSince = text(tenantData?.pastDueSince) || null;
    if (!isSubscriptionBlocked(status, pastDueSince)) {
      return { redirectTo: "/", screen: NO_SESSION };
    }

    const isTenantAdmin = TENANT_ADMIN_ROLES.has(role);
    let ownerName: string | null = null;
    if (!isTenantAdmin && masterId) {
      ownerName = text((await db.collection("users").doc(masterId).get()).get("name")) || null;
    }

    const hasStripe = Boolean(text(tenantData?.stripeSubscriptionId) || text(tenantData?.stripeCustomerId));
    const billing: BlockedScreenInput["billing"] =
      tenantData?.isManualSubscription === true || !hasStripe ? "manual" : "stripe";

    return {
      redirectTo: null,
      screen: {
        hasSession: true,
        isTenantAdmin,
        billing,
        status,
        periodEndLabel: billing === "manual" ? contractDayLabel(text(tenantData?.currentPeriodEnd)) : null,
        tenantName: text(tenantData?.name) || null,
        ownerName,
      },
    };
  } catch {
    return { redirectTo: null, screen: NO_SESSION };
  }
});
