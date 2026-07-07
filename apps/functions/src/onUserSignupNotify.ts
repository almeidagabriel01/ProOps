import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { db } from "./init";
import { logger } from "./lib/logger";
import { isEmulatedRuntime } from "./lib/rate-limit/emulator";
import { notifyInternalLifecycle } from "./services/email/internal-notify";

/**
 * Notifica a ProOps por email quando um novo usuário é criado. O signup é
 * client-side (frontend cria users/{uid} direto via SDK), então o trigger é
 * o único ponto que cobre todos os fluxos (email/senha, Google, membros de
 * equipe criados pelo admin e caminhos futuros).
 */

type SnapLike =
  | { data: () => Record<string, unknown> | undefined }
  | undefined;

type EventLike = {
  data?: SnapLike;
  params: { uid: string };
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function handleUserCreatedNotify(event: EventLike): Promise<void> {
  try {
    const data = event.data?.data();
    if (!data) return;
    if (isEmulatedRuntime()) return;

    const uid = event.params.uid;
    const tenantId = asString(data.tenantId);
    if (!tenantId) {
      logger.warn("[onUserSignupNotify] user doc without tenantId", { uid });
      return;
    }

    // Trigger é at-least-once: claim determinístico garante 1 email por uid.
    try {
      await db
        .collection("internal_notify_claims")
        .doc(`signup_${uid}`)
        .create({ createdAt: new Date() });
    } catch {
      return; // ALREADY_EXISTS — retry do trigger, email já enviado.
    }

    const isOwnerSignup = tenantId === `tenant_${uid}`;

    await notifyInternalLifecycle({
      event: isOwnerSignup ? "signup" : "team_member_added",
      tenantId,
      userId: uid,
      userData: {
        name: asString(data.name),
        email: asString(data.email),
        phone: asString(data.phoneNumber),
        role: asString(data.role),
      },
    });
  } catch (err) {
    // Email não vale um retry-loop do trigger — loga e encerra.
    logger.error("[onUserSignupNotify] failed", {
      uid: event.params?.uid,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export const onUserSignupNotify = onDocumentCreated(
  { document: "users/{uid}", memory: "256MiB", timeoutSeconds: 60 },
  async (event) => handleUserCreatedNotify(event as unknown as EventLike),
);
