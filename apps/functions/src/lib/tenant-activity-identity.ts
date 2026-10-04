import { createHash } from "crypto";
import { auth, db } from "../init";
import { parseSuperAdminAllowlist } from "./auth-context";

/**
 * Quem mandou um lote de atividade. O navegador envia por `sendBeacon`, que
 * não carrega cabeçalho `Authorization`, então o ID token vem no corpo e a
 * identidade sai SÓ dele, nunca de um `tenantId` ou `uid` do corpo.
 *
 * Diferente de `verifyReportIdentity` (erros do navegador), aqui o papel
 * importa: super admin não grava atividade, e `free` marca a demonstração.
 * Logo depois do cadastro o token ainda não tem as claims, e esses minutos são
 * justamente a jornada que o painel quer ver; por isso, faltando papel ou
 * empresa, lê `users/{uid}` (o mesmo fallback de `auth-context.ts`).
 *
 * Cache por instância, pelo hash do token: um token vale ~1h e manda dezenas
 * de lotes, e sem cache cada lote de uma conta recém-criada leria o doc.
 * Nunca lança e nunca loga o token.
 */

export interface ActivityIdentity {
  uid: string;
  tenantId: string | null;
  role: string | null;
  isSuperAdmin: boolean;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 2000;
const cache = new Map<string, { identity: ActivityIdentity; expiresAt: number }>();

export function clearActivityIdentityCacheForTest(): void {
  cache.clear();
}

function clean(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

export async function resolveActivityIdentity(
  idToken: unknown,
  nowMs: number = Date.now(),
): Promise<ActivityIdentity | null> {
  if (typeof idToken !== "string" || idToken.length === 0 || idToken.length > 8192) return null;
  const key = createHash("sha256").update(idToken).digest("hex");
  const cached = cache.get(key);
  if (cached && cached.expiresAt > nowMs) return cached.identity;

  try {
    const decoded = await auth.verifyIdToken(idToken);
    let role = clean((decoded as { role?: unknown }).role);
    let tenantId = clean((decoded as { tenantId?: unknown }).tenantId);

    if (!role || !tenantId) {
      const snap = await db.collection("users").doc(decoded.uid).get();
      const data = (snap.exists ? snap.data() : undefined) as
        | { role?: unknown; tenantId?: unknown; companyId?: unknown }
        | undefined;
      role = role ?? clean(data?.role);
      tenantId = tenantId ?? clean(data?.tenantId) ?? clean(data?.companyId);
    }

    const allowlist = parseSuperAdminAllowlist();
    const email = clean(decoded.email)?.toLowerCase();
    const isSuperAdmin =
      role?.toUpperCase() === "SUPERADMIN" ||
      allowlist.includes(decoded.uid) ||
      (email ? allowlist.some((entry) => entry.toLowerCase() === email) : false);

    const identity: ActivityIdentity = {
      uid: decoded.uid,
      tenantId,
      role: role ? role.toLowerCase() : null,
      isSuperAdmin,
    };
    const tokenExpiresMs = typeof decoded.exp === "number" ? decoded.exp * 1000 : nowMs + CACHE_TTL_MS;
    cache.set(key, { identity, expiresAt: Math.min(nowMs + CACHE_TTL_MS, tokenExpiresMs) });
    if (cache.size > CACHE_MAX) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    return identity;
  } catch {
    return null;
  }
}
