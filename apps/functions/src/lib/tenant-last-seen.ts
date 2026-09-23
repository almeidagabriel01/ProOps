import { db } from "../init";
import { logger } from "./logger";

/**
 * "Ultima vez online" da empresa.
 *
 * Serve a duas perguntas do painel: a conta que criou e nunca assinou voltou a
 * entrar? A empresa que paga ainda usa o ERP? Nada respondia isso: o painel so
 * tinha contadores de proposta e lancamento, que crescem uma vez e nunca mais.
 *
 * **E registrado por EVENTO, nao por tempo.** O frontend avisa uma vez quando a
 * plataforma abre autenticada (login novo ou sessao que ja existia), e a hora
 * gravada e a daquele instante. A primeira versao gravava em toda request
 * autenticada, no maximo uma vez a cada 15 minutos: barato, mas impreciso por
 * construcao (quem entrava 10:00 e voltava 10:10 ficava registrado como 10:00)
 * e com escrita no caminho de TODA request.
 *
 * O unico limite de tempo que sobrou e antirrepeticao: uma tela em laco de
 * recarga nao vira uma escrita por segundo. Ele e curto de proposito, para nao
 * descartar acesso de verdade.
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

/** Janela antirrepeticao: protege de laco de recarga, nao define a precisao. */
export const LAST_SEEN_DEDUPE_MS = 60 * 1000;

/** Teto do mapa em memoria: instancia longeva nao acumula tenant para sempre. */
const MAX_TRACKED_TENANTS = 1000;

const lastWrittenAt = new Map<string, number>();

export function shouldRecordLastSeen(
  lastWrittenMs: number | undefined,
  nowMs: number,
  dedupeMs: number = LAST_SEEN_DEDUPE_MS,
): boolean {
  if (lastWrittenMs === undefined) return true;
  return nowMs - lastWrittenMs >= dedupeMs;
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

  // Marca ANTES de gravar: dois avisos simultaneos da mesma empresa nao
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
