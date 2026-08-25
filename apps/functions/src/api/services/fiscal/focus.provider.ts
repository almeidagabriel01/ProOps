/**
 * Focus NFe implementation of `FiscalProvider`.
 *
 * Auth is HTTP Basic with the API token as the username and a blank password.
 * Tokens are per environment and come from env:
 *   FOCUS_NFE_TOKEN_HOMOLOGACAO
 *   FOCUS_NFE_TOKEN_PRODUCAO
 *
 * Issuing is asynchronous: Focus pre-validates synchronously (400 on a
 * malformed body) then queues the document. A `processing` result is the
 * expected happy path — the webhook or the retry cron settles it.
 */

import axios from "axios";
import { logger } from "../../../lib/logger";
import { describeFocusError } from "./focus-error";
import { buildEmpresaPayload, buildInvoicePayload } from "./focus-payload";
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
} from "./fiscal-types";

const BASE_URLS: Record<FiscalEnvironment, string> = {
  homologacao: "https://homologacao.focusnfe.com.br",
  producao: "https://api.focusnfe.com.br",
};

/** Focus keeps NF-e and NFS-e on separate resource paths. */
const RESOURCE_PATH: Record<FiscalDocumentType, string> = {
  nfe: "nfe",
  nfse: "nfse",
};

const REQUEST_TIMEOUT_MS = 30_000;

export function resolveFocusBaseUrl(env: FiscalEnvironment): string {
  return BASE_URLS[env];
}

function resolveToken(env: FiscalEnvironment): string {
  const token =
    env === "producao"
      ? String(process.env.FOCUS_NFE_TOKEN_PRODUCAO || "").trim()
      : String(process.env.FOCUS_NFE_TOKEN_HOMOLOGACAO || "").trim();

  if (!token) {
    throw new Error("FOCUS_NFE_TOKEN_NAO_CONFIGURADO");
  }
  return token;
}

/** HTTP Basic: token as user, empty password. */
function buildAuthHeader(env: FiscalEnvironment): string {
  const token = resolveToken(env);
  return `Basic ${Buffer.from(`${token}:`).toString("base64")}`;
}

function buildRequestConfig(env: FiscalEnvironment) {
  return {
    headers: {
      Authorization: buildAuthHeader(env),
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
    const url = `${resolveFocusBaseUrl(env)}/v2/empresas${dryRun ? "?dry_run=1" : ""}`;

    try {
      const response = await axios.post<{ id?: number | string; cnpj?: string }>(
        url,
        buildEmpresaPayload(issuer),
        buildRequestConfig(env),
      );

      return {
        ...(response.data?.id !== undefined
          ? { providerIssuerId: String(response.data.id) }
          : {}),
        cnpj: String(response.data?.cnpj || issuer.cnpj).replace(/\D/g, ""),
        habilitaNfe: issuer.habilitaNfe,
        habilitaNfse: issuer.habilitaNfse,
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
    const url = `${resolveFocusBaseUrl(env)}/v2/cnpjs/${clean}`;

    const response = await axios.get<Record<string, string | undefined>>(
      url,
      buildRequestConfig(env),
    );
    const data = response.data || {};

    const pick = (value: string | undefined): string | undefined => {
      const text = String(value || "").trim();
      return text || undefined;
    };

    // Only defined keys are assigned, so a partially filled CNPJ record never
    // overwrites wizard fields the user already typed with empty strings.
    return {
      cnpj: clean,
      razaoSocial: pick(data.nome_empresarial || data.razao_social),
      nomeFantasia: pick(data.nome_fantasia),
      cnae: pick(data.cnae_fiscal),
      logradouro: pick(data.logradouro),
      numero: pick(data.numero),
      complemento: pick(data.complemento),
      bairro: pick(data.bairro),
      municipio: pick(data.municipio),
      codigoIbge: pick(data.codigo_municipio_ibge || data.codigo_municipio),
      uf: pick(data.uf),
      cep: pick(data.cep),
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
  ): Promise<FiscalInvoiceResult> {
    const baseUrl = resolveFocusBaseUrl(env);
    const resource = RESOURCE_PATH[input.type];
    const url = `${baseUrl}/v2/${resource}?ref=${encodeURIComponent(input.ref)}`;

    const response = await axios.post<FocusInvoiceResponse>(
      url,
      buildInvoicePayload(input),
      buildRequestConfig(env),
    );

    return mapFocusResponse(response.data || {}, input.type, input.ref, baseUrl);
  }

  async consult(
    ref: string,
    type: FiscalDocumentType,
    env: FiscalEnvironment,
  ): Promise<FiscalInvoiceResult> {
    const baseUrl = resolveFocusBaseUrl(env);
    const url = `${baseUrl}/v2/${RESOURCE_PATH[type]}/${encodeURIComponent(ref)}`;

    const response = await axios.get<FocusInvoiceResponse>(url, buildRequestConfig(env));
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
  ): Promise<FiscalInvoiceResult> {
    const baseUrl = resolveFocusBaseUrl(env);
    const url = `${baseUrl}/v2/${RESOURCE_PATH[type]}/${encodeURIComponent(ref)}`;

    const response = await axios.delete<FocusInvoiceResponse>(url, {
      ...buildRequestConfig(env),
      data: { justificativa },
    });

    return mapFocusResponse(response.data || {}, type, ref, baseUrl);
  }

  /** Carta de Correção Eletrônica — NF-e only. */
  async correct(
    ref: string,
    texto: string,
    env: FiscalEnvironment,
  ): Promise<FiscalInvoiceResult> {
    const baseUrl = resolveFocusBaseUrl(env);
    const url = `${baseUrl}/v2/nfe/${encodeURIComponent(ref)}/carta_correcao`;

    const response = await axios.post<FocusInvoiceResponse>(
      url,
      { correcao: texto },
      buildRequestConfig(env),
    );

    return mapFocusResponse(response.data || {}, "nfe", ref, baseUrl);
  }

  /**
   * Registers a notification hook for one CNPJ and document kind.
   *
   * Focus keys hooks by (cnpj, event, url) and rejects a duplicate, so the
   * caller reconciles first — see `registerFiscalWebhooks`.
   */
  async registerWebhook(
    cnpj: string,
    event: FiscalDocumentType,
    url: string,
    env: FiscalEnvironment,
  ): Promise<string | undefined> {
    const response = await axios.post<{ id?: string }>(
      `${resolveFocusBaseUrl(env)}/v2/hooks`,
      { cnpj: String(cnpj).replace(/\D/g, ""), event, url },
      buildRequestConfig(env),
    );
    return response.data?.id;
  }

  async listWebhooks(
    env: FiscalEnvironment,
  ): Promise<Array<{ id?: string; cnpj?: string; event?: string; url?: string }>> {
    const response = await axios.get<Array<{ id?: string; cnpj?: string; event?: string; url?: string }>>(
      `${resolveFocusBaseUrl(env)}/v2/hooks`,
      buildRequestConfig(env),
    );
    return Array.isArray(response.data) ? response.data : [];
  }

  async deleteWebhook(hookId: string, env: FiscalEnvironment): Promise<void> {
    await axios.delete(
      `${resolveFocusBaseUrl(env)}/v2/hooks/${encodeURIComponent(hookId)}`,
      buildRequestConfig(env),
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
  ): Promise<void> {
    const baseUrl = resolveFocusBaseUrl(env);
    const url = `${baseUrl}/v2/hooks/${RESOURCE_PATH[type]}/${encodeURIComponent(ref)}`;

    await axios.post(url, {}, buildRequestConfig(env));
  }
}

export const focusFiscalProvider = new FocusFiscalProvider();
