/**
 * Per-tenant fiscal configuration.
 *
 * Lives in its own `fiscal_settings` collection rather than as a map on
 * `tenants/{id}` for one concrete reason: `firestore.rules` lets any member of
 * a tenant read the tenant document, and Firestore has no field-level rules.
 * A secret stored there is readable by every user of that tenant. This
 * collection denies all client access and is reachable only through the Admin
 * SDK — the same shape `calendar_integrations` uses.
 *
 * The A1 certificate itself is never persisted here. It is forwarded to the
 * provider once during registration and dropped; only its password (needed to
 * re-register on a provider change) is kept, KMS-encrypted.
 */

import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../../../init";
import { logger } from "../../../lib/logger";
import { decryptToken, encryptToken } from "../../../lib/token-encryption";
import type { FiscalProviderId } from "./fiscal-provider";
import type {
  FiscalAddress,
  FiscalEnvironment,
  FiscalIssuerConfig,
  FiscalTaxRegime,
  FiscalNfsePadrao,
} from "./fiscal-types";

const COLLECTION = "fiscal_settings";

/** KMS namespace for fiscal secrets — deliberately separate from the calendar key. */
const KMS_PURPOSE = "FISCAL_SECRET" as const;

/**
 * How far the issuer got in the wizard.
 *
 * `ready` is only reached after a test document is authorized in homologação,
 * which is what proves the company is actually credentialed with the SEFAZ or
 * the municipality — the failure the whole market discovers on the first real
 * sale instead.
 */
export type FiscalSetupStatus = "pending" | "registered" | "ready" | "error";

export interface FiscalSettingsDocument {
  tenantId: string;
  provider: FiscalProviderId;
  environment: FiscalEnvironment;
  status: FiscalSetupStatus;

  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
  cnae?: string;
  regimeTributario: FiscalTaxRegime;
  email: string;
  telefone?: string;
  endereco: FiscalAddress;

  habilitaNfe: boolean;
  habilitaNfse: boolean;
  /** Recepcao de notas de entrada. Desligada por padrao — consome pacote. */
  habilitaManifestacao?: boolean;
  padraoNfse?: FiscalNfsePadrao;
  regimeApuracaoSimplesNacional?: 1 | 2 | 3;
  serieNfe?: number;
  proximoNumeroNfe?: number;
  serieNfse?: string;
  proximoNumeroNfse?: number;

  /** KMS ciphertext. Never returned to any caller. */
  certificadoSenhaEnc?: string;
  /** Expiry of the A1 certificate, for the renewal alerts. ISO date. */
  certificadoValidade?: string;

  providerIssuerId?: string;
  /**
   * Per-company issuing credentials, KMS-encrypted, one per environment.
   *
   * Minted by the provider when the company is registered. Issuing uses these
   * and never the account-level token, so no bug can emit under another
   * tenant's CNPJ.
   */
  focusTokenHomologacaoEnc?: string;
  focusTokenProducaoEnc?: string;
  /**
   * Authenticates the provider's notification callback.
   *
   * Focus NFe sends no authentication header — unlike Asaas, which signs with
   * `asaas-access-token`. So the webhook URL itself is the credential and this
   * secret is a path segment in it. Generated once and never returned to any
   * client.
   */
  webhookSecret?: string;
  /** Resultado do ultimo registro de gatilho — publico, nao contem a URL. */
  webhookStatus?: {
    state: "registered" | "failed" | "partial";
    attemptedAt: string;
    registered: string[];
    lastError?: string;
  };
  /** `manual` until the tenant opts into an automatic trigger. */
  autoIssueRule: FiscalAutoIssueRule;
  defaultNaturezaOperacao?: string;

  lastError?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type FiscalAutoIssueRule = "manual" | "on_payment" | "on_proposal_approved";

/**
 * The safe projection.
 *
 * Everything a client may see. The encrypted password has no accessor at all —
 * not omitted at the edge, but absent from the type, so a future endpoint
 * cannot leak it by spreading the document.
 */
export interface FiscalSettingsPublic {
  configured: boolean;
  provider?: FiscalProviderId;
  environment?: FiscalEnvironment;
  status?: FiscalSetupStatus;
  cnpj?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
  cnae?: string;
  regimeTributario?: FiscalTaxRegime;
  email?: string;
  telefone?: string;
  endereco?: FiscalAddress;
  habilitaNfe?: boolean;
  habilitaNfse?: boolean;
  habilitaManifestacao?: boolean;
  padraoNfse?: FiscalNfsePadrao;
  regimeApuracaoSimplesNacional?: 1 | 2 | 3;
  serieNfe?: number;
  proximoNumeroNfe?: number;
  serieNfse?: string;
  proximoNumeroNfse?: number;
  /** Whether a certificate password is on file — never the value. */
  certificadoArmazenado?: boolean;
  certificadoValidade?: string;
  /** Days until the A1 certificate expires; negative once expired. */
  certificadoDiasParaVencer?: number;
  autoIssueRule?: FiscalAutoIssueRule;
  defaultNaturezaOperacao?: string;
  /** Estado do gatilho de notificacao. Nao expoe a URL, que carrega o segredo. */
  webhookStatus?: {
    state: "registered" | "failed" | "partial";
    attemptedAt: string;
    registered: string[];
    lastError?: string;
  };
  lastError?: string;
  updatedAt?: string;
}

function docRef(tenantId: string) {
  return db.collection(COLLECTION).doc(tenantId);
}

/** Whole days from today to `isoDate`; negative once past. */
export function daysUntil(isoDate: string, now: Date = new Date()): number {
  const target = new Date(isoDate);
  if (Number.isNaN(target.getTime())) {
    return Number.NaN;
  }
  const startOfDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((startOfDay(target) - startOfDay(now)) / 86_400_000);
}

/**
 * Strips every secret and derives the display-only fields.
 * The single place a fiscal settings document becomes client-visible.
 */
export function toPublicSettings(
  doc: FiscalSettingsDocument | null,
  now: Date = new Date(),
): FiscalSettingsPublic {
  if (!doc) {
    return { configured: false };
  }

  const publicView: FiscalSettingsPublic = {
    configured: true,
    provider: doc.provider,
    environment: doc.environment,
    status: doc.status,
    cnpj: doc.cnpj,
    razaoSocial: doc.razaoSocial,
    regimeTributario: doc.regimeTributario,
    email: doc.email,
    endereco: doc.endereco,
    habilitaNfe: doc.habilitaNfe,
    habilitaNfse: doc.habilitaNfse,
    habilitaManifestacao: doc.habilitaManifestacao === true,
    padraoNfse: doc.padraoNfse === "municipal" ? "municipal" : "nacional",
    autoIssueRule: doc.autoIssueRule,
    certificadoArmazenado: Boolean(doc.certificadoSenhaEnc),
  };

  // Assigned one by one rather than through a keyed loop so the compiler keeps
  // checking that each value matches its field — this projection is the guard
  // against leaking a secret, and a cast would disable exactly that check.
  if (doc.nomeFantasia) publicView.nomeFantasia = doc.nomeFantasia;
  if (doc.inscricaoEstadual) publicView.inscricaoEstadual = doc.inscricaoEstadual;
  if (doc.inscricaoMunicipal) publicView.inscricaoMunicipal = doc.inscricaoMunicipal;
  if (doc.cnae) publicView.cnae = doc.cnae;
  if (doc.telefone) publicView.telefone = doc.telefone;
  if (doc.serieNfe !== undefined) publicView.serieNfe = doc.serieNfe;
  if (doc.proximoNumeroNfe !== undefined) publicView.proximoNumeroNfe = doc.proximoNumeroNfe;
  if (doc.serieNfse) publicView.serieNfse = doc.serieNfse;
  if (doc.proximoNumeroNfse !== undefined) {
    publicView.proximoNumeroNfse = doc.proximoNumeroNfse;
  }
  if (doc.certificadoValidade) publicView.certificadoValidade = doc.certificadoValidade;
  if (doc.defaultNaturezaOperacao) {
    publicView.defaultNaturezaOperacao = doc.defaultNaturezaOperacao;
  }
  if (doc.webhookStatus) publicView.webhookStatus = doc.webhookStatus;
  if (doc.lastError) publicView.lastError = doc.lastError;
  if (doc.updatedAt) publicView.updatedAt = doc.updatedAt;

  if (doc.certificadoValidade) {
    const remaining = daysUntil(doc.certificadoValidade, now);
    if (!Number.isNaN(remaining)) {
      publicView.certificadoDiasParaVencer = remaining;
    }
  }

  return publicView;
}

export async function getFiscalSettings(
  tenantId: string,
): Promise<FiscalSettingsDocument | null> {
  const snap = await docRef(tenantId).get();
  if (!snap.exists) {
    return null;
  }
  return { ...(snap.data() as FiscalSettingsDocument), tenantId };
}

export interface SaveFiscalSettingsInput
  extends Omit<
    FiscalSettingsDocument,
    "tenantId" | "status" | "certificadoSenhaEnc" | "createdAt" | "updatedAt" | "provider"
  > {
  provider?: FiscalProviderId;
  /** Plaintext, encrypted before it touches Firestore. Omit to keep the stored one. */
  certificadoSenha?: string;
  /** Devolvidos pelo provedor no registro da empresa. Cifrados antes de gravar. */
  tokenHomologacao?: string;
  tokenProducao?: string;
}

/**
 * Creates or updates the tenant's fiscal configuration.
 *
 * Saving never promotes the tenant to `ready` — only an authorized test
 * document does that. A re-save of an already-ready configuration drops it
 * back to `registered`, because changed issuer data has to be proven again.
 */
export async function saveFiscalSettings(
  tenantId: string,
  input: SaveFiscalSettingsInput,
): Promise<FiscalSettingsDocument> {
  const now = new Date().toISOString();
  const existing = await getFiscalSettings(tenantId);

  const payload: Record<string, unknown> = {
    tenantId,
    provider: input.provider ?? existing?.provider ?? "focus",
    environment: input.environment,
    cnpj: String(input.cnpj || "").replace(/\D/g, ""),
    razaoSocial: input.razaoSocial,
    regimeTributario: input.regimeTributario,
    email: input.email,
    endereco: input.endereco,
    habilitaNfe: input.habilitaNfe,
    habilitaNfse: input.habilitaNfse,
    habilitaManifestacao: input.habilitaManifestacao === true,
    padraoNfse: input.padraoNfse === "municipal" ? "municipal" : "nacional",
    regimeApuracaoSimplesNacional: input.regimeApuracaoSimplesNacional ?? 1,
    autoIssueRule: input.autoIssueRule,
    status: existing?.status === "ready" ? "registered" : (existing?.status ?? "pending"),
    updatedAt: now,
    ...(existing ? {} : { createdAt: now }),
  };

  const optional: Array<[string, unknown]> = [
    ["nomeFantasia", input.nomeFantasia],
    ["inscricaoEstadual", input.inscricaoEstadual],
    ["inscricaoMunicipal", input.inscricaoMunicipal],
    ["cnae", input.cnae],
    ["telefone", input.telefone],
    ["serieNfe", input.serieNfe],
    ["proximoNumeroNfe", input.proximoNumeroNfe],
    ["serieNfse", input.serieNfse],
    ["proximoNumeroNfse", input.proximoNumeroNfse],
    ["certificadoValidade", input.certificadoValidade],
    ["providerIssuerId", input.providerIssuerId],
    ["defaultNaturezaOperacao", input.defaultNaturezaOperacao],
  ];
  for (const [key, value] of optional) {
    // `undefined` means "not supplied, keep what is stored"; an empty string
    // means "clear it", and Firestore needs an explicit delete for that.
    if (value !== undefined) {
      payload[key] = value === "" ? FieldValue.delete() : value;
    }
  }

  if (input.certificadoSenha) {
    payload.certificadoSenhaEnc = await encryptToken(input.certificadoSenha, KMS_PURPOSE);
  }

  if (input.tokenHomologacao) {
    payload.focusTokenHomologacaoEnc = await encryptToken(input.tokenHomologacao, KMS_PURPOSE);
  }
  if (input.tokenProducao) {
    payload.focusTokenProducaoEnc = await encryptToken(input.tokenProducao, KMS_PURPOSE);
  }

  // Gerado uma única vez. Rotacioná-lo a cada save invalidaria os gatilhos já
  // registrados no provedor e derrubaria a notificação em silêncio.
  if (!existing?.webhookSecret) {
    payload.webhookSecret = crypto.randomBytes(24).toString("hex");
  }

  await docRef(tenantId).set(payload, { merge: true });

  logger.info("Configuração fiscal salva", {
    tenantId,
    cnpj: payload.cnpj,
    environment: input.environment,
    habilitaNfe: input.habilitaNfe,
    habilitaNfse: input.habilitaNfse,
  });

  const saved = await getFiscalSettings(tenantId);
  if (!saved) {
    throw new Error("FISCAL_SETTINGS_SAVE_FAILED");
  }
  return saved;
}

/** Records how far setup got. `lastError` is cleared on any non-error status. */
export async function setFiscalStatus(
  tenantId: string,
  status: FiscalSetupStatus,
  lastError?: string,
): Promise<void> {
  await docRef(tenantId).set(
    {
      status,
      updatedAt: new Date().toISOString(),
      ...(status === "error" && lastError
        ? { lastError }
        : { lastError: FieldValue.delete() }),
    },
    { merge: true },
  );
}

/**
 * Decrypts the issuing token for the tenant's current environment.
 *
 * @throws when the company was never registered with the provider — issuing
 * without a company token would either fail obscurely or, worse, fall back to
 * an account-level credential.
 */
export async function getIssuingToken(
  tenantId: string,
  environment: FiscalEnvironment,
): Promise<string> {
  const settings = await getFiscalSettings(tenantId);
  const stored =
    environment === "producao"
      ? settings?.focusTokenProducaoEnc
      : settings?.focusTokenHomologacaoEnc;

  if (!stored) {
    throw new Error("FISCAL_EMITENTE_NAO_REGISTRADO");
  }
  return decryptToken(stored, KMS_PURPOSE);
}

export async function getCertificatePassword(tenantId: string): Promise<string | null> {
  const settings = await getFiscalSettings(tenantId);
  if (!settings?.certificadoSenhaEnc) {
    return null;
  }
  return decryptToken(settings.certificadoSenhaEnc, KMS_PURPOSE);
}

/**
 * Assembles the provider-facing issuer config.
 *
 * The certificate is supplied by the caller because it is never stored: the
 * wizard passes the freshly uploaded `.pfx`, and a re-registration without one
 * fails loudly rather than silently registering a company with no certificate.
 */
export function buildIssuerConfig(
  settings: FiscalSettingsDocument,
  certificadoBase64: string,
  certificadoSenha: string,
): FiscalIssuerConfig {
  return {
    cnpj: settings.cnpj,
    razaoSocial: settings.razaoSocial,
    nomeFantasia: settings.nomeFantasia,
    inscricaoEstadual: settings.inscricaoEstadual,
    inscricaoMunicipal: settings.inscricaoMunicipal,
    cnae: settings.cnae,
    regimeTributario: settings.regimeTributario,
    email: settings.email,
    telefone: settings.telefone,
    endereco: settings.endereco,
    certificadoBase64,
    certificadoSenha,
    habilitaNfe: settings.habilitaNfe,
    habilitaNfse: settings.habilitaNfse,
    habilitaManifestacao: settings.habilitaManifestacao === true,
    padraoNfse: settings.padraoNfse === "municipal" ? "municipal" : "nacional",
    // Sem isto o campo nunca chega ao payload e o XSD do Ambiente Nacional
    // rejeita a DPS por `regTrib` sem filho.
    regimeApuracaoSimplesNacional: settings.regimeApuracaoSimplesNacional ?? 1,
    serieNfe: settings.serieNfe,
    proximoNumeroNfe: settings.proximoNumeroNfe,
    serieNfse: settings.serieNfse,
    proximoNumeroNfse: settings.proximoNumeroNfse,
  };
}

export async function deleteFiscalSettings(tenantId: string): Promise<void> {
  await docRef(tenantId).delete();
  logger.info("Configuração fiscal removida", { tenantId });
}
