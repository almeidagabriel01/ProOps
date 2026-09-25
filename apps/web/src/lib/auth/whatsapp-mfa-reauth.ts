import { signOut, type Auth } from "firebase/auth";
import { hardRedirect } from "@/lib/auth/hard-redirect";

/**
 * O backend responde 403 `WHATSAPP_MFA_REQUIRED` quando o login tem o 2FA do
 * WhatsApp ativo e ainda não passou pelo código (ver
 * `apps/functions/src/lib/whatsapp-mfa-session.ts`). No uso normal isso não
 * acontece: o código é pedido antes de entrar. Acontece com quem já estava
 * logado quando a exigência passou a valer na API, e aí toda chamada falharia
 * com uma tela quebrada. A saída é entrar de novo, e o login pede o código.
 */
export const WHATSAPP_MFA_REQUIRED_CODE = "WHATSAPP_MFA_REQUIRED";

let reauthInFlight = false;

export function isWhatsappMfaRequiredError(data: unknown): boolean {
  return (data as { code?: unknown } | null)?.code === WHATSAPP_MFA_REQUIRED_CODE;
}

/** Desloga e manda para o login uma vez só, mesmo com várias chamadas falhando juntas. */
export async function forceWhatsappMfaReauth(auth: Auth): Promise<void> {
  if (reauthInFlight) return;
  reauthInFlight = true;
  try {
    await signOut(auth);
  } catch {
    // O redirect abaixo resolve do mesmo jeito: sem cookie, o login pede tudo.
  }
  hardRedirect("/login?redirect_reason=session_expired");
}

export function resetWhatsappMfaReauthForTest(): void {
  reauthInFlight = false;
}
