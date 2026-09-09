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
import { getIssuingToken } from "./fiscal-settings.service";
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
/**
 * "Ja existe um gatilho para este evento, empresa e url" NAO e falha.
 *
 * O Focus registra por (CNPJ, evento, URL) e recusa duplicata. Se ele diz que
 * ja existe, o gatilho **esta no ar com a URL que queremos** — o estado
 * desejado foi alcancado, so nao por esta chamada. Tratar isso como erro
 * mostrava "Notificacao automatica nao registrada" sobre uma integracao
 * funcionando, e mandava o usuario clicar em "Tentar de novo" para sempre.
 *
 * Acontece quando o `reconcile` nao apagou o hook antigo: `listWebhooks` pode
 * ter falhado (o catch de la so registra warning) ou devolvido a lista de outro
 * ambiente. Nos dois casos o desfecho e o mesmo — e e bom.
 */
export function isDuplicateWebhookError(detail: {
  codigo?: string;
  message?: string;
}): boolean {
  // Separadores viram espaco: so a MENSAGEM foi observada de fato
  // ("Ja existe um gatilho..."); o formato do `codigo` nao. Normalizar deixa
  // `ja_existe` e `ja-existe` casarem sem inventar um valor especifico.
  const texto = `${detail.codigo ?? ""} ${detail.message ?? ""}`
    .toLowerCase()
    .replace(/[_-]+/g, " ");
  return (
    texto.includes("já existe") ||
    texto.includes("ja existe") ||
    texto.includes("already exists")
  );
}

async function reconcile(
  cnpj: string,
  event: string,
  url: string,
  env: FiscalEnvironment,
  token: string,
): Promise<void> {
  try {
    const hooks = await focusFiscalProvider.listWebhooks(env, token);
    const stale = hooks.filter(
      (hook) => hook.url === url && String(hook.cnpj || "").replace(/\D/g, "") === cnpj,
    );

    for (const hook of stale) {
      if (hook.id) {
        await focusFiscalProvider.deleteWebhook(hook.id, env, token);
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

  /**
   * Token da EMPRESA, não o da conta: é ele que define em qual ambiente o
   * gatilho nasce. Sem ele o registro cria um hook de produção que nunca
   * notifica uma nota de homologação — e o painel do provedor mostra isso como
   * "Ambiente: Produção", que passa despercebido.
   */
  let token: string;
  try {
    token = await getIssuingToken(params.tenantId, params.environment);
  } catch (error) {
    const detail = describeFocusError(error);
    return persist(params.tenantId, {
      state: "failed",
      attemptedAt: new Date().toISOString(),
      registered: [],
      lastError: detail.message,
    });
  }

  for (const event of events) {
    const url = resolveFiscalWebhookUrl(params.tenantId, params.webhookSecret, event);
    try {
      await reconcile(cnpj, event, url, params.environment, token);
      await focusFiscalProvider.registerWebhook(
        cnpj,
        event,
        url,
        params.environment,
        token,
      );
      registered.push(event);
    } catch (error) {
      const detail = describeFocusError(error);

      // Duplicata = o gatilho que queremos já está lá. Conta como registrado.
      if (isDuplicateWebhookError(detail)) {
        registered.push(event);
        logger.info("Gatilho fiscal já existia no provedor", {
          tenantId: params.tenantId,
          cnpj,
          event,
        });
        continue;
      }

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

  return persist(params.tenantId, status);
}

/** Grava o resultado e devolve — o estado tem que sobreviver ao request. */
async function persist(
  tenantId: string,
  status: FiscalWebhookStatus,
): Promise<FiscalWebhookStatus> {
  await db
    .collection("fiscal_settings")
    .doc(tenantId)
    .set({ webhookStatus: status }, { merge: true });
  return status;
}
