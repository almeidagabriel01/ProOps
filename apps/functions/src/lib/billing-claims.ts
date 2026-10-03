import { auth, db } from "../init";
import { logger } from "./logger";

export interface BillingClaimsUpdate {
  subscriptionStatus: string;
  subscriptionPlan?: string;
  subscriptionUpdatedAt?: string;
}

// Nenhum status de cobrança revoga a sessão. Até 2026-10 unpaid, inactive e
// payment_failed revogavam, e quem perdia o acesso era jogado no login sem
// explicação (o membro nem sabia com quem falar). Agora a pessoa continua
// logada e fica em /subscription-blocked, com a mensagem e o caminho para
// regularizar. O bloqueio segue imediato onde importa: o proxy, a API
// (requireActiveSubscription) e as telas leem o doc do tenant a cada request.
// Custo aceito: até o token renovar (~1h), as rules ainda veem a claim antiga e
// deixam a pessoa ler os dados da PRÓPRIA empresa direto no Firestore.

const BATCH_CONCURRENCY = 20;
const BATCH_SIZE = 100;
const MAX_RETRIES = 3;

async function applyClaimsToUser(
  uid: string,
  billingClaims: Record<string, string>,
): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const userRecord = await auth.getUser(uid);
      const existing = userRecord.customClaims ?? {};
      // Spread existing first — setCustomUserClaims replaces, does not merge.
      await auth.setCustomUserClaims(uid, { ...existing, ...billingClaims });
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) =>
          setTimeout(resolve, 100 * attempt),
        );
      }
    }
  }
  throw lastErr;
}

/**
 * Propagates billing status changes into Firebase Auth custom claims for every
 * user in the tenant. Never revokes the session (see the note above).
 *
 * Paginates all users (no 50-user hard cap). Processes in concurrent batches of
 * 20 with per-user retry (3 attempts). Throws an aggregated error if any users
 * could not be updated after all retries — callers should catch and log but not
 * fail the billing operation (Stripe webhook will reconcile on next event).
 *
 * CRITICAL: always spreads existing claims before writing — setCustomUserClaims
 * REPLACES the entire claims object, so omitting existing claims (tenantId,
 * role, masterId) would revoke access for all affected users.
 */
export async function applyBillingClaimsToTenantUsers(
  tenantId: string,
  claimsUpdate: BillingClaimsUpdate,
): Promise<void> {
  const normalizedTenantId = String(tenantId || "").trim();
  if (!normalizedTenantId) return;

  const billingClaims: Record<string, string> = {
    subscriptionStatus: claimsUpdate.subscriptionStatus,
    ...(claimsUpdate.subscriptionPlan !== undefined && {
      subscriptionPlan: claimsUpdate.subscriptionPlan,
    }),
    subscriptionUpdatedAt:
      claimsUpdate.subscriptionUpdatedAt ?? new Date().toISOString(),
  };

  const failedUids: string[] = [];
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;

  while (true) {
    let query = db
      .collection("users")
      .where("tenantId", "==", normalizedTenantId)
      .limit(BATCH_SIZE);
    if (lastDoc) query = query.startAfter(lastDoc);

    const snap = await query.get();
    if (snap.empty) break;

    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += BATCH_CONCURRENCY) {
      const chunk = docs.slice(i, i + BATCH_CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map((docSnap) =>
          applyClaimsToUser(docSnap.id, billingClaims),
        ),
      );
      results.forEach((result, idx) => {
        if (result.status === "rejected") {
          failedUids.push(chunk[idx].id);
        }
      });
    }

    if (docs.length < BATCH_SIZE) break;
    lastDoc = docs[docs.length - 1];
  }

  if (failedUids.length > 0) {
    logger.warn("billing_claims: partial_failure", {
      tenantId: normalizedTenantId,
      failedCount: failedUids.length,
      failedSample: failedUids.slice(0, 10),
    });
    throw new Error(
      `billing_claims: failed for ${failedUids.length} user(s) in tenant ${normalizedTenantId}`,
    );
  }
}
