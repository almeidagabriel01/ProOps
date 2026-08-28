/**
 * Registra os gatilhos de notificação do provedor para um tenant.
 *
 * Sem isso o webhook nunca dispara e toda nota fica dependendo do cron de 15
 * minutos — a diferença entre a nota aparecer autorizada em segundos e o
 * usuário olhar para "processando" por um quarto de hora.
 *
 * Reconcilia antes de criar, como `AsaasService.registerWebhookForTenant`: o
 * Focus rejeita gatilho duplicado para a mesma URL, e sem a limpeza um segundo
 * registro falharia para sempre.
 *
 * **Nunca lança.** Falha de registro vira estado persistido e um alerta na UI —
 * bloquear o cadastro do emitente por causa do webhook seria trocar um problema
 * recuperável por um impeditivo, ainda mais existindo o cron como rede.
 */

import { db } from "../../../init";
import { logger } from "../../../lib/logger";
import { resolveFiscalWebhookUrl } from "../../../lib/frontend-app-url";
import { describeFocusError } from "./focus-error";
import { focusFiscalProvider, resolveResourcePath } from "./focus.provider";
import type { FiscalEnvironment, FiscalNfsePadrao } from "./fiscal-types";

export interface FiscalWebhookStatus {
  state: "registered" | "failed" | "partial";
  attemptedAt: string;
  /** Nomes de EVENTO no provedor — `nfe`, `nfse` ou `nfsen`. */
  registered: string[];
  lastError?: string;
}

/**
 * Remove gatilhos que já apontam para a nossa URL antes de recriar.
 * Falha aqui é tolerada: se a listagem não veio, a criação ainda pode dar certo.
 */
async function reconcile(
  cnpj: string,
  event: string,
  url: string,
  env: FiscalEnvironment,
): Promise<void> {
  try {
    const hooks = await focusFiscalProvider.listWebhooks(env);
    const stale = hooks.filter(
      (hook) => hook.url === url && String(hook.cnpj || "").replace(/\D/g, "") === cnpj,
    );

    for (const hook of stale) {
      if (hook.id) {
        await focusFiscalProvider.deleteWebhook(hook.id, env);
      }
    }
  } catch (error) {
    logger.warn("Reconciliacao de gatilhos fiscais falhou", {
      cnpj,
      event,
      error: describeFocusError(error).message,
    });
  }
}

/**
 * Cria um gatilho por tipo de documento habilitado.
 *
 * O Focus registra o gatilho por (CNPJ, evento, URL), e a URL carrega o
 * segredo do tenant — é ela que autentica a chamada de volta, já que o Focus
 * não envia cabeçalho de autenticação.
 */
export async function registerFiscalWebhooks(params: {
  tenantId: string;
  cnpj: string;
  webhookSecret: string;
  environment: FiscalEnvironment;
  habilitaNfe: boolean;
  habilitaNfse: boolean;
  padraoNfse?: FiscalNfsePadrao;
}): Promise<FiscalWebhookStatus> {
  const cnpj = String(params.cnpj).replace(/\D/g, "");

  /**
   * O gatilho é registrado pelo nome do EVENTO no provedor, e o evento tem que
   * ser o mesmo recurso em que a nota é emitida. Registrar `nfse` e emitir em
   * `nfsen` não dá erro em lugar nenhum — simplesmente nunca chega notificação,
   * e toda nota fica presa em `processing` até o cron de 15 min. Foi o que
   * aconteceu com a primeira nota real: ela já estava rejeitada no Ambiente
   * Nacional e a ProOps ainda mostrava "Processando".
   */
  const events: string[] = [
    ...(params.habilitaNfe ? [resolveResourcePath("nfe")] : []),
    ...(params.habilitaNfse ? [resolveResourcePath("nfse", params.padraoNfse)] : []),
  ];

  const registered: string[] = [];
  let lastError: string | undefined;

  for (const event of events) {
    const url = resolveFiscalWebhookUrl(params.tenantId, params.webhookSecret, event);
    try {
      await reconcile(cnpj, event, url, params.environment);
      await focusFiscalProvider.registerWebhook(cnpj, event, url, params.environment);
      registered.push(event);
    } catch (error) {
      const detail = describeFocusError(error);
      lastError = detail.message;
      // A URL contém o segredo do tenant — nunca logar.
      logger.error("Registro de gatilho fiscal falhou", {
        tenantId: params.tenantId,
        cnpj,
        event,
        codigo: detail.codigo,
        httpStatus: detail.httpStatus,
        error: detail.message,
      });
    }
  }

  const status: FiscalWebhookStatus = {
    state:
      registered.length === events.length
        ? "registered"
        : registered.length > 0
          ? "partial"
          : "failed",
    attemptedAt: new Date().toISOString(),
    registered,
    ...(lastError ? { lastError } : {}),
  };

  await db
    .collection("fiscal_settings")
    .doc(params.tenantId)
    .set({ webhookStatus: status }, { merge: true });

  return status;
}
