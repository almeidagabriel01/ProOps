import { LRUCache } from "lru-cache";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "../init";

/**
 * Faz o 2FA do WhatsApp valer na API, e não só na criação do cookie do site.
 *
 * Até 2026-09 o código do WhatsApp era conferido apenas pela rota de sessão do
 * Next. O backend aceitava qualquer ID token válido, e um ID token se obtém só
 * com a senha, pela API pública do Firebase. Com ele dava para ler os dados da
 * empresa, desligar o próprio 2FA (`/whatsapp-mfa/disable`) ou gerar códigos de
 * recuperação novos e entrar com eles. O segundo fator não protegia nada fora
 * da tela.
 *
 * O TOTP nativo não tem esse problema: ele fica no próprio token
 * (`firebase.sign_in_second_factor`). O WhatsApp é nosso, então a prova precisa
 * morar do nosso lado: `mfa_sessions/{uid}_{auth_time}`, gravado quando o código
 * (ou um código de recuperação) é aceito. `auth_time` identifica AQUELE login e
 * não muda quando o token é renovado, então a marca vale para a sessão inteira
 * e não se transfere para outro login com a mesma senha.
 */
export const MFA_SESSIONS_COLLECTION = "mfa_sessions";

/** Quanto tempo um login verificado dispensa novo código. */
export const MFA_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type MfaSessionMethod = "whatsapp" | "whatsapp_enroll" | "recovery_code";

export function mfaSessionDocId(uid: string, authTimeSeconds: number): string {
  return `${uid}_${Math.floor(authTimeSeconds)}`;
}

/**
 * Rotas que a própria tela de login chama ANTES de o código ser digitado. Todo
 * o resto exige a sessão verificada, inclusive desligar o 2FA, cadastrar outro
 * número e gerar códigos de recuperação: são exatamente os atalhos de quem só
 * tem a senha.
 */
export const WHATSAPP_MFA_EXEMPT_PATHS: ReadonlySet<string> = new Set([
  "/v1/auth/whatsapp-mfa/challenge",
  "/v1/auth/whatsapp-mfa/verify",
  "/v1/auth/recovery-codes/verify",
]);

export function isWhatsappMfaExemptPath(path: string): boolean {
  const normalized = path.replace(/\/+$/, "");
  return WHATSAPP_MFA_EXEMPT_PATHS.has(normalized);
}

export interface WhatsappMfaGateInput {
  /** `users/{uid}.whatsappMfaEnabled === true` com telefone cadastrado. */
  whatsappMfaEnabled: boolean;
  isSuperAdmin: boolean;
  /** TOTP nativo satisfeito neste login (`firebase.sign_in_second_factor`). */
  nativeSecondFactor: boolean;
  /** Login por código de recuperação (`recovery_login`, token do backend). */
  recoveryLogin: boolean;
  /** Login pelo WhatsApp na tela do TOTP (`whatsapp_login`, token do backend). */
  whatsappLogin: boolean;
  /** Existe `mfa_sessions/{uid}_{auth_time}` válido. */
  sessionVerified: boolean;
}

/** true = este token ainda deve o código do WhatsApp. */
export function isWhatsappMfaPending(input: WhatsappMfaGateInput): boolean {
  if (!input.whatsappMfaEnabled) return false;
  // Superadmin é só TOTP; o cadastro do WhatsApp recusa superadmin.
  if (input.isSuperAdmin) return false;
  if (input.nativeSecondFactor) return false;
  if (input.recoveryLogin) return false;
  if (input.whatsappLogin) return false;
  return !input.sessionVerified;
}

export function userHasWhatsappMfa(userDoc: Record<string, unknown> | undefined): boolean {
  return (
    userDoc?.whatsappMfaEnabled === true &&
    typeof userDoc.whatsappMfaPhone === "string" &&
    userDoc.whatsappMfaPhone.trim() !== ""
  );
}

// Só respostas POSITIVAS ficam em cache: uma negativa em cache prenderia o
// usuário na tela por até o TTL logo depois de digitar o código certo.
const verifiedCache = new LRUCache<string, true>({ max: 5_000, ttl: 10 * 60_000 });

export async function isMfaSessionVerified(
  uid: string,
  authTimeSeconds: number | undefined,
  nowMs: number = Date.now(),
): Promise<boolean> {
  if (!authTimeSeconds) return false;
  const id = mfaSessionDocId(uid, authTimeSeconds);
  if (verifiedCache.get(id)) return true;
  const snap = await db.collection(MFA_SESSIONS_COLLECTION).doc(id).get();
  if (!snap.exists) return false;
  const expiresAt = snap.get("expiresAt") as Timestamp | undefined;
  if (!expiresAt || expiresAt.toMillis() <= nowMs) return false;
  verifiedCache.set(id, true);
  return true;
}

/**
 * Documento e referência da marca, para quem precisa gravá-la dentro de uma
 * transação (o código de recuperação é consumido e a sessão marcada juntos).
 * Depois do commit, chame `rememberVerifiedMfaSession`.
 */
export function buildMfaSessionWrite(
  uid: string,
  authTimeSeconds: number | undefined,
  method: MfaSessionMethod,
  nowMs: number = Date.now(),
) {
  if (!authTimeSeconds) {
    throw new Error("MFA_SESSION_WITHOUT_AUTH_TIME");
  }
  const id = mfaSessionDocId(uid, authTimeSeconds);
  return {
    id,
    ref: db.collection(MFA_SESSIONS_COLLECTION).doc(id),
    data: {
      uid,
      authTime: Math.floor(authTimeSeconds),
      method,
      verifiedAt: Timestamp.fromMillis(nowMs),
      // Timestamp (não string) para a TTL do Firestore poder agir.
      expiresAt: Timestamp.fromMillis(nowMs + MFA_SESSION_TTL_MS),
    },
  };
}

export function rememberVerifiedMfaSession(id: string): void {
  verifiedCache.set(id, true);
}

export async function recordVerifiedMfaSession(
  uid: string,
  authTimeSeconds: number | undefined,
  method: MfaSessionMethod,
  nowMs: number = Date.now(),
): Promise<void> {
  const write = buildMfaSessionWrite(uid, authTimeSeconds, method, nowMs);
  await write.ref.set(write.data);
  rememberVerifiedMfaSession(write.id);
}

export function clearMfaSessionCacheForTest(): void {
  verifiedCache.clear();
}
