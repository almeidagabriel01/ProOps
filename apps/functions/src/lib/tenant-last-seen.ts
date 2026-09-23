import { db } from "../init";
import { logger } from "./logger";

/**
 * "Ultima vez online" da empresa.
 *
 * Serve a duas perguntas do painel: a conta que criou e nunca assinou voltou a
 * entrar? A empresa que paga ainda usa o ERP? Nada respondia isso: o painel so
 * tinha contadores de proposta e lancamento, que crescem uma vez e nunca mais.
 *
 * Grava em `tenants/{id}.lastSeenAt` a partir do middleware de autenticacao,
 * no maximo uma vez a cada 15 minutos por empresa, por instancia. O efeito e
 * que o valor pode SUBESTIMAR o ultimo acesso em ate a janela (quem entra
 * 10:00 e 10:10 fica registrado como 10:00), o que e irrelevante para "voltou?"
 * e mantem o custo desprezivel: uma empresa com alguem trabalhando 8 horas gera
 * ~32 escritas no dia.
 *
 * Duas exclusoes deliberadas:
 * - **super admin nao conta.** Abrir o painel de uma empresa pelo "Acessar
 *   Painel" marcaria como acesso dela algo que foi seu, e a coluna passaria a
 *   mentir justamente nas empresas que voce anda investigando.
 * - **nunca CRIA o documento do tenant.** Usa `update`, e ignora NOT_FOUND: um
 *   `set` com merge criaria um doc so com `lastSeenAt` para tenant legado (que
 *   vive em `companies`) e para empresa ja excluida, mudando a resolucao de
 *   plano e ressuscitando o que a exclusao definitiva apagou.
 */

export const LAST_SEEN_WINDOW_MS = 15 * 60 * 1000;

/** Teto do mapa em memoria: instancia longeva nao acumula tenant para sempre. */
const MAX_TRACKED_TENANTS = 1000;

const lastWrittenAt = new Map<string, number>();

export function shouldRecordLastSeen(
  lastWrittenMs: number | undefined,
  nowMs: number,
  windowMs: number = LAST_SEEN_WINDOW_MS,
): boolean {
  if (lastWrittenMs === undefined) return true;
  return nowMs - lastWrittenMs >= windowMs;
}

/** O acesso conta como acesso DA EMPRESA? */
export function countsAsTenantAccess(input: {
  tenantId?: string | null;
  role?: string | null;
}): boolean {
  if (!String(input.tenantId || "").trim()) return false;
  return String(input.role || "").trim().toUpperCase() !== "SUPERADMIN";
}

export function clearLastSeenCacheForTest(): void {
  lastWrittenAt.clear();
}

export async function recordTenantLastSeen(input: {
  tenantId?: string | null;
  role?: string | null;
  nowMs?: number;
}): Promise<void> {
  if (!countsAsTenantAccess(input)) return;

  const tenantId = String(input.tenantId).trim();
  const nowMs = input.nowMs ?? Date.now();
  if (!shouldRecordLastSeen(lastWrittenAt.get(tenantId), nowMs)) return;

  // Marca ANTES de gravar: duas requests simultaneas da mesma empresa nao
  // disparam duas escritas, e uma falha nao vira tentativa a cada request.
  lastWrittenAt.set(tenantId, nowMs);
  if (lastWrittenAt.size > MAX_TRACKED_TENANTS) {
    const oldest = lastWrittenAt.keys().next().value;
    if (oldest) lastWrittenAt.delete(oldest);
  }

  try {
    await db
      .collection("tenants")
      .doc(tenantId)
      .update({ lastSeenAt: new Date(nowMs).toISOString() });
  } catch (err) {
    const code = (err as { code?: number | string }).code;
    // 5 = NOT_FOUND: tenant legado sem documento. Nao criar.
    if (code === 5 || code === "not-found") return;
    logger.warn("last_seen_write_failed", {
      tenantId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
