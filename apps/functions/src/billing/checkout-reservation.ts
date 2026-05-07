import { db } from "../init";
import type { Transaction } from "firebase-admin/firestore";

const RESERVATION_TTL_MS = 5 * 60 * 1000;

export type ReserveCheckoutResult =
  | { ok: true }
  | { ok: false; reason: "RECENT_CHECKOUT_IN_FLIGHT"; until: string };

export async function reserveCheckout(input: {
  tenantId: string;
  planTier: string;
  billingInterval: string;
  ttlMs?: number;
}): Promise<ReserveCheckoutResult> {
  const ttlMs = input.ttlMs ?? RESERVATION_TTL_MS;
  const tenantRef = db.collection("tenants").doc(input.tenantId);

  return db.runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(tenantRef);
    const data = snap.data() as Record<string, unknown> | undefined;
    const existingAt = data?.checkoutInFlightAt;

    if (existingAt && typeof existingAt === "string") {
      const elapsed = Date.now() - new Date(existingAt).getTime();
      if (elapsed < ttlMs) {
        const until = new Date(new Date(existingAt).getTime() + ttlMs).toISOString();
        return {
          ok: false as const,
          reason: "RECENT_CHECKOUT_IN_FLIGHT" as const,
          until,
        };
      }
    }

    tx.set(
      tenantRef,
      {
        checkoutInFlightAt: new Date().toISOString(),
        checkoutInFlightContext: {
          planTier: input.planTier,
          billingInterval: input.billingInterval,
        },
      },
      { merge: true },
    );

    return { ok: true as const };
  });
}

export async function clearCheckoutReservation(tenantId: string): Promise<void> {
  await db.collection("tenants").doc(tenantId).set(
    { checkoutInFlightAt: null, checkoutInFlightContext: null },
    { merge: true },
  );
}
