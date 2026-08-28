/**
 * Focus NFe implementation of `FiscalProvider`.
 *
 * Auth is HTTP Basic with a token as the username and a blank password. There
 * are **two levels of token**, and mixing them up is the easiest way to break
 * this integration:
 *
 *  - **Account token** (`FOCUS_NFE_MASTER_TOKEN`) — manages the company
 *    registry: create/list companies, look up CNPJs, register webhooks.
 *  - **Per-company token** — returned by `POST /v2/empresas` as
 *    `token_homologacao` / `token_producao`, and required to issue that
 *    company's documents.
 *
 * The per-company split is a gift for a multi-tenant ERP: each tenant's
 * documents are signed with that tenant's own credential, so no bug can issue
 * under the wrong CNPJ. The tokens are stored KMS-encrypted in
 * `fiscal_settings` and passed in per call — never read from env here.
 *
 * Issuing is asynchronous: Focus pre-validates synchronously (400 on a
 * malformed body) then queues the document. A `processing` result is the
 * expected happy path — the webhook or the retry cron settles it.
 */

import axios from "axios";
import { logger } from "../../../lib/logger";
import { describeFocusError } from "./focus-error";
import {
  buildEmpresaPayload,
  buildInvoicePayload,
  resolveNfsePadrao,
} from "./focus-payload";
import { mapFocusResponse, type FocusInvoiceResponse } from "./focus-response";
import type {
  FiscalCnpjLookup,
  FiscalProvider,
  FiscalProviderCapabilities,
} from "./fiscal-provider";
import type {
  FiscalDocumentType,
  FiscalEnvironment,
  FiscalInvoiceInput,
  FiscalInvoiceResult,
  FiscalIssuerConfig,
  FiscalIssuerResult,
  FiscalNfsePadrao,
  FiscalTaxRegime,
} from "./fiscal-types";

const BASE_URLS: Record<FiscalEnvironment, string> = {
  homologacao: "https://homologacao.focusnfe.com.br",
  producao: "https://api.focusnfe.com.br",
};

/**
 * Cada documento tem seu próprio recurso — e a NFS-e tem **dois**, um por padrão.
 *
 * `nfsen` é a NFS-e Nacional (Ambiente Nacional, DANFSe); `nfse` é a municipal,
 * para as prefeituras que ainda mantêm sistema próprio. Resolver isso aqui, e não
 * no domínio, é o que mantém `FiscalDocumentType` com dois valores — ver
 * `FiscalNfsePadrao`.
 */
export function resolveResourcePath(
  type: FiscalDocumentType,
  padraoNfse?: FiscalNfsePadrao,
): string {
  if (type === "nfe") return "nfe";
  return resolveNfsePadrao(padraoNfse) === "nacional" ? "nfsen" : "nfse";
}

const REQUEST_TIMEOUT_MS = 30_000;

export function resolveFocusBaseUrl(env: FiscalEnvironment): string {
  return BASE_URLS[env];
}

/**
 * Base das operações de **cadastro** — `/empresas` e `/cnpjs`.
 *
 * Elas existem só em produção, e isso é desenho, não limitação: o cadastro de
 * empresas é único, e o ambiente é expresso por *qual token* a empresa devolve
 * (`token_homologacao` / `token_producao`) e por quais flags `habilita_*` ela
 * recebe — nunca pela URL. Consultar CNPJ então é consultar a Receita, que não
 * tem versão de teste.
 *
 * Verificado em 27/08/2026 batendo nos dois hosts sem token: em
 * `homologacao.focusnfe.com.br` os dois caminhos respondem **404**; em
 * `api.focusnfe.com.br`, **401**. `/hooks` responde 401 nos dois, por isso
 * gatilho continua seguindo o ambiente.
 *
 * A divisão é a mesma dos tokens: **token da conta ⇒ base de cadastro; token da
 * empresa ⇒ base do ambiente**. Vale também para `/hooks`, mesmo esse caminho
 * existindo nos dois hosts: quem autentica ali é o token da conta, e o exemplo
 * da própria documentação usa o host de produção. Registrar gatilho contra o
 * host de homologação não devolvia erro visível — `registerFiscalWebhooks` não
 * lança de propósito —, e o resultado era nenhum gatilho registrado e toda nota
 * dependendo do cron.
 */
export function resolveRegistryBaseUrl(): string {
  return BASE_URLS.producao;
}

/**
 * Account-level token, from env. Manages the company registry only.
 * It must never reach an issuing call — that is what the per-company token is
 * for, and using the master there would let a bug issue under another CNPJ.
 */
function resolveMasterToken(): string {
  const token = String(process.env.FOCUS_NFE_MASTER_TOKEN || "").trim();
  if (!token) {
    throw new Error("FOCUS_NFE_TOKEN_NAO_CONFIGURADO");
  }
  return token;
}

/** HTTP Basic: token as user, empty password. */
function buildAuthHeader(token: string): string {
  return `Basic ${Buffer.from(`${token}:`).toString("base64")}`;
}

function buildRequestConfig(token: string) {
  return {
    headers: {
      Authorization: buildAuthHeader(token),
      "Content-Type": "application/json",
    },
    timeout: REQUEST_TIMEOUT_MS,
    // 4xx bodies carry the validation details we need, so let them through to
    // the caller's catch rather than having axios swallow the payload.
    validateStatus: (status: number) => status >= 200 && status < 300,
  };
}

const CAPABILITIES: FiscalProviderCapabilities = {
  nfe: true,
  nfse: true,
  nfce: true,
};

interface FocusCnpjResponse {
  razao_social?: string;
  cnae_principal?: string;
  situacao_cadastral?: string;
  optante_simples_nacional?: boolean;
  optante_mei?: boolean;
  /** O endereço é um objeto aninhado, com nomes próprios. */
  endereco?: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    nome_municipio?: string;
    codigo_ibge?: string | number;
    uf?: string;
    cep?: string;
  };
}

/**
 * CRT a partir do que a Receita já sabe.
 *
 * Só devolve algo quando a resposta traz as flags — ausência é diferente de
 * "não é optante", e assumir Regime Normal por omissão trocaria CSOSN por CST
 * na nota inteira de uma empresa do Simples.
 */
function regimeFromSimplesFlags(data: FocusCnpjResponse): FiscalTaxRegime | undefined {
  if (data.optante_mei === true) return 4;
  if (data.optante_simples_nacional === true) return 1;
  if (data.optante_simples_nacional === false && data.optante_mei === false) return 3;
  return undefined;
}

export class FocusFiscalProvider implements FiscalProvider {
  readonly id = "focus" as const;
  readonly capabilities = CAPABILITIES;

  supports(type: FiscalDocumentType): boolean {
    return type === "nfe" ? this.capabilities.nfe : this.capabilities.nfse;
  }

  /**
   * Creates or updates the issuing company.
   *
   * Focus keys companies by CNPJ, so a repeated call updates instead of
   * duplicating. `dryRun` exercises the whole validation path — certificate
   * included — without persisting, which is how the wizard checks a
   * configuration before committing to it.
   */
  async registerIssuer(
    issuer: FiscalIssuerConfig,
    env: FiscalEnvironment,
    dryRun = false,
  ): Promise<FiscalIssuerResult> {
    const url = `${resolveRegistryBaseUrl()}/v2/empresas${dryRun ? "?dry_run=1" : ""}`;

    try {
      const response = await axios.post<{
        id?: number | string;
        cnpj?: string;
        token_homologacao?: string;
        token_producao?: string;
        certificado_valido_ate?: string;
        certificado_cnpj?: string;
      }>(url, buildEmpresaPayload(issuer), buildRequestConfig(resolveMasterToken()));

      const data = response.data ?? {};

      return {
        ...(data.id !== undefined ? { providerIssuerId: String(data.id) } : {}),
        cnpj: String(data.cnpj || issuer.cnpj).replace(/\D/g, ""),
        habilitaNfe: issuer.habilitaNfe,
        habilitaNfse: issuer.habilitaNfse,
        // Ausentes num dry run — ele valida sem criar a empresa.
        ...(data.token_homologacao ? { tokenHomologacao: data.token_homologacao } : {}),
        ...(data.token_producao ? { tokenProducao: data.token_producao } : {}),
        // Lidos do proprio .pfx pelo provedor — o usuario nao precisa digitar.
        ...(data.certificado_valido_ate
          ? { certificadoValidoAte: data.certificado_valido_ate }
          : {}),
        ...(data.certificado_cnpj ? { certificadoCnpj: data.certificado_cnpj } : {}),
      };
    } catch (err) {
      const detail = describeFocusError(err);
      // The CNPJ is not a secret and is the only way to tell which tenant's
      // configuration failed; the certificate and password are never logged.
      logger.error("focus.registerIssuer falhou", {
        cnpj: String(issuer.cnpj).replace(/\D/g, ""),
        env,
        dryRun,
        codigo: detail.codigo,
        httpStatus: detail.httpStatus,
        error: detail.message,
      });
      throw err;
    }
  }

  async lookupCnpj(cnpj: string, env: FiscalEnvironment): Promise<FiscalCnpjLookup> {
    const clean = String(cnpj).replace(/\D/g, "");
    const url = `${resolveRegistryBaseUrl()}/v2/cnpjs/${clean}`;

    const response = await axios.get<FocusCnpjResponse>(
      url,
      buildRequestConfig(resolveMasterToken()),
    );
    const data = response.data || {};
    // O endereço vem ANINHADO, não plano — ler `data.logradouro` devolve
    // undefined e o wizard fica com metade dos campos vazios sem erro nenhum.
    const endereco = data.endereco || {};

    const pick = (value: string | number | undefined): string | undefined => {
      const text = String(value ?? "").trim();
      return text || undefined;
    };

    // Only defined keys are assigned, so a partially filled CNPJ record never
    // overwrites wizard fields the user already typed with empty strings.
    return {
      cnpj: clean,
      razaoSocial: pick(data.razao_social),
      cnae: pick(data.cnae_principal),
      logradouro: pick(endereco.logradouro),
      numero: pick(endereco.numero),
      complemento: pick(endereco.complemento),
      bairro: pick(endereco.bairro),
      // A Receita chama de `nome_municipio`; `municipio` não existe na resposta.
      municipio: pick(endereco.nome_municipio),
      codigoIbge: pick(endereco.codigo_ibge),
      uf: pick(endereco.uf),
      cep: pick(endereco.cep),
      ...(regimeFromSimplesFlags(data) !== undefined
        ? { regimeTributario: regimeFromSimplesFlags(data) }
        : {}),
      situacaoCadastral: pick(data.situacao_cadastral),
    };
  }

  /**
   * Sends a document for authorization.
   *
   * `ref` is a required query parameter and is ours to choose, which makes the
   * call idempotent for free: re-sending the same ref never produces a second
   * document — Focus answers `already_processed`.
   */
  async issue(
    input: FiscalInvoiceInput,
    env: FiscalEnvironment,
    token: string,
  ): Promise<FiscalInvoiceResult> {
    const baseUrl = resolveFocusBaseUrl(env);
    const resource = resolveResourcePath(input.type, input.issuer.padraoNfse);
    const url = `${baseUrl}/v2/${resource}?ref=${encodeURIComponent(input.ref)}`;

    const response = await axios.post<FocusInvoiceResponse>(
      url,
      buildInvoicePayload(input, env),
      buildRequestConfig(token),
    );

    return mapFocusResponse(response.data || {}, input.type, input.ref, baseUrl);
  }

  async consult(
    ref: string,
    type: FiscalDocumentType,
    env: FiscalEnvironment,
    token: string,
    padraoNfse?: FiscalNfsePadrao,
  ): Promise<FiscalInvoiceResult> {
    const baseUrl = resolveFocusBaseUrl(env);
    const resource = resolveResourcePath(type, padraoNfse);
    const url = `${baseUrl}/v2/${resource}/${encodeURIComponent(ref)}`;

    const response = await axios.get<FocusInvoiceResponse>(url, buildRequestConfig(token));
    return mapFocusResponse(response.data || {}, type, ref, baseUrl);
  }

  /**
   * Cancels an authorized document.
   *
   * The justification is passed straight through; length validation belongs to
   * the caller so the user sees the problem before a request leaves.
   */
  async cancel(
    ref: string,
    type: FiscalDocumentType,
    justificativa: string,
    env: FiscalEnvironment,
    token: string,
    padraoNfse?: FiscalNfsePadrao,
  ): Promise<FiscalInvoiceResult> {
    const baseUrl = resolveFocusBaseUrl(env);
    const resource = resolveResourcePath(type, padraoNfse);
    const url = `${baseUrl}/v2/${resource}/${encodeURIComponent(ref)}`;

    const response = await axios.delete<FocusInvoiceResponse>(url, {
      ...buildRequestConfig(token),
      data: { justificativa },
    });

    return mapFocusResponse(response.data || {}, type, ref, baseUrl);
  }

  /** Carta de Correção Eletrônica — NF-e only. */
  async correct(
    ref: string,
    texto: string,
    env: FiscalEnvironment,
    token: string,
  ): Promise<FiscalInvoiceResult> {
    const baseUrl = resolveFocusBaseUrl(env);
    const url = `${baseUrl}/v2/nfe/${encodeURIComponent(ref)}/carta_correcao`;

    const response = await axios.post<FocusInvoiceResponse>(
      url,
      { correcao: texto },
      buildRequestConfig(token),
    );

    return mapFocusResponse(response.data || {}, "nfe", ref, baseUrl);
  }

  /**
   * Lista notas emitidas CONTRA o CNPJ — as notas de entrada.
   *
   * `versao` é o cursor: a API devolve as 100 primeiras acima do valor
   * informado. Guardando a maior versão vista, buscamos só o que ainda não
   * conhecemos, em vez de varrer tudo a cada consulta.
   */
  async listReceivedInvoices(
    env: FiscalEnvironment,
    token: string,
    sinceVersion = 0,
  ): Promise<Record<string, unknown>[]> {
    const url = `${resolveFocusBaseUrl(env)}/v2/nfes_recebidas?versao=${sinceVersion}`;
    const response = await axios.get<Record<string, unknown>[]>(
      url,
      buildRequestConfig(token),
    );
    return Array.isArray(response.data) ? response.data : [];
  }

  /** Dados já estruturados de uma nota recebida — dispensa parser de XML. */
  async getReceivedInvoice(
    chaveAcesso: string,
    env: FiscalEnvironment,
    token: string,
  ): Promise<Record<string, unknown>> {
    const url = `${resolveFocusBaseUrl(env)}/v2/nfes_recebidas/${encodeURIComponent(chaveAcesso)}/json`;
    const response = await axios.get<Record<string, unknown>>(url, buildRequestConfig(token));
    return response.data ?? {};
  }

  /**
   * Manifestação do destinatário.
   *
   * Ato formal perante a Receita — a justificativa só se aplica a
   * "operação não realizada", e a validação de tamanho fica no chamador para o
   * usuário ver o problema antes de a requisição sair.
   */
  async manifestReceivedInvoice(
    chaveAcesso: string,
    tipo: string,
    env: FiscalEnvironment,
    token: string,
    justificativa?: string,
  ): Promise<void> {
    const url = `${resolveFocusBaseUrl(env)}/v2/nfes_recebidas/${encodeURIComponent(chaveAcesso)}/manifesto`;
    await axios.post(
      url,
      { tipo, ...(justificativa ? { justificativa } : {}) },
      buildRequestConfig(token),
    );
  }

  /**
   * Registers a notification hook for one CNPJ and document kind.
   *
   * Focus keys hooks by (cnpj, event, url) and rejects a duplicate, so the
   * caller reconciles first — see `registerFiscalWebhooks`.
   *
   * **O token decide o ambiente do gatilho.** Registrar com o token da conta
   * cria um hook de PRODUÇÃO — o painel mostra "Utilizar Token: Token Principal
   * de Produção · Ambiente: Produção" —, e ele nunca notifica uma nota emitida
   * em homologação. Por isso aqui vale a mesma regra da emissão: token da
   * empresa daquele ambiente, na base daquele ambiente.
   */
  async registerWebhook(
    cnpj: string,
    /** Nome do EVENTO no provedor: `nfe`, `nfse` ou `nfsen`. */
    event: string,
    url: string,
    env: FiscalEnvironment,
    token: string,
  ): Promise<string | undefined> {
    const response = await axios.post<{ id?: string }>(
      `${resolveFocusBaseUrl(env)}/v2/hooks`,
      { cnpj: String(cnpj).replace(/\D/g, ""), event, url },
      buildRequestConfig(token),
    );
    return response.data?.id;
  }

  async listWebhooks(
    env: FiscalEnvironment,
    token: string,
  ): Promise<Array<{ id?: string; cnpj?: string; event?: string; url?: string }>> {
    // Lista os hooks DAQUELE token, ou seja, daquele ambiente. Listar com o
    // token da conta devolveria os de produção e o reconcile apagaria os
    // errados — ou nenhum.
    const response = await axios.get<Array<{ id?: string; cnpj?: string; event?: string; url?: string }>>(
      `${resolveFocusBaseUrl(env)}/v2/hooks`,
      buildRequestConfig(token),
    );
    return Array.isArray(response.data) ? response.data : [];
  }

  async deleteWebhook(
    hookId: string,
    env: FiscalEnvironment,
    token: string,
  ): Promise<void> {
    await axios.delete(
      `${resolveFocusBaseUrl(env)}/v2/hooks/${encodeURIComponent(hookId)}`,
      buildRequestConfig(resolveMasterToken()),
    );
  }

  /**
   * Asks Focus to replay its notification to every registered webhook.
   * Recovers a dropped event without touching the document itself.
   */
  async replayNotification(
    ref: string,
    type: FiscalDocumentType,
    env: FiscalEnvironment,
    token: string,
    padraoNfse?: FiscalNfsePadrao,
  ): Promise<void> {
    const baseUrl = resolveFocusBaseUrl(env);
    const resource = resolveResourcePath(type, padraoNfse);
    const url = `${baseUrl}/v2/hooks/${resource}/${encodeURIComponent(ref)}`;

    await axios.post(url, {}, buildRequestConfig(token));
  }
}

export const focusFiscalProvider = new FocusFiscalProvider();
