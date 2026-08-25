import { Request, Response } from "express";
import { resolveUserAndTenant } from "../../lib/auth-helpers";
import { logger } from "../../lib/logger";
import { describeFocusError } from "../services/fiscal/focus-error";
import {
  getFiscalProvider,
  resolveFiscalEnvironment,
} from "../services/fiscal/fiscal-provider.registry";
import {
  buildIssuerConfig,
  getCertificatePassword,
  getFiscalSettings,
  saveFiscalSettings,
  setFiscalStatus,
  toPublicSettings,
  type FiscalAutoIssueRule,
} from "../services/fiscal/fiscal-settings.service";
import type { FiscalTaxRegime } from "../services/fiscal/fiscal-types";
import {
  buildNcmPrompt,
  parseNcmSuggestions,
  NCM_MAX_OUTPUT_TOKENS,
  NCM_SYSTEM_PROMPT,
} from "../services/fiscal/ncm-suggestion";
import { getTenantPlanProfile } from "../../lib/tenant-plan-policy";
import {
  checkAiLimit,
  reserveAiMessage,
  finalizeTokenUsage,
  refundAiMessage,
} from "../../ai/usage-tracker";
import { sanitizeText } from "../../utils/sanitize";

/** Sugestao por IA segue o mesmo gate dos demais recursos de IA. */
const NCM_AI_PLANS = new Set<string>(["pro", "enterprise"]);

function mapFiscalErrorStatus(error: Error): number {
  if (error.message === "FISCAL_SETTINGS_NOT_FOUND") return 404;
  if (error.message === "FISCAL_CERTIFICADO_AUSENTE") return 422;
  if (error.message === "FISCAL_SETTINGS_SAVE_FAILED") return 500;
  if (error.message === "FOCUS_NFE_TOKEN_NAO_CONFIGURADO") return 503;
  if (error.message.startsWith("FISCAL_SECRET_KMS_KEY")) return 500;
  if (error.message.startsWith("FISCAL_PROVIDER_NAO_SUPORTADO")) return 422;
  if (
    error.message.startsWith("FORBIDDEN_") ||
    error.message.startsWith("AUTH_CLAIMS_MISSING_")
  ) {
    return 403;
  }
  return 500;
}

/** Fiscal configuration is a company-level setting, not a per-member one. */
async function requireFiscalAdmin(
  req: Request,
  res: Response,
): Promise<{ tenantId: string; isSuperAdmin: boolean } | null> {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({ message: "Não autenticado" });
    return null;
  }

  const { tenantId, isMaster, isSuperAdmin } = await resolveUserAndTenant(userId, req.user);
  if (!isMaster && !isSuperAdmin) {
    res.status(403).json({ message: "Sem permissão para configurar notas fiscais" });
    return null;
  }

  return { tenantId, isSuperAdmin };
}

const VALID_REGIMES: FiscalTaxRegime[] = [1, 2, 3, 4];
const VALID_AUTO_ISSUE: FiscalAutoIssueRule[] = [
  "manual",
  "on_payment",
  "on_proposal_approved",
];

interface AddressInput {
  logradouro?: unknown;
  numero?: unknown;
  complemento?: unknown;
  bairro?: unknown;
  municipio?: unknown;
  codigoIbge?: unknown;
  uf?: unknown;
  cep?: unknown;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Returns the first validation failure, or null when the address is usable. */
function validateAddress(raw: AddressInput | undefined): string | null {
  if (!raw || typeof raw !== "object") {
    return "Endereço do emitente é obrigatório";
  }
  const required: Array<[keyof AddressInput, string]> = [
    ["logradouro", "Logradouro é obrigatório"],
    ["numero", "Número é obrigatório"],
    ["bairro", "Bairro é obrigatório"],
    ["municipio", "Município é obrigatório"],
    ["uf", "UF é obrigatória"],
    ["cep", "CEP é obrigatório"],
  ];
  for (const [field, message] of required) {
    if (!text(raw[field])) return message;
  }
  if (text(raw.uf).length !== 2) {
    return "UF deve ter 2 letras";
  }
  if (text(raw.cep).replace(/\D/g, "").length !== 8) {
    return "CEP deve ter 8 dígitos";
  }
  // The SEFAZ validates the municipality against its own IBGE table; the name
  // alone is one of the most common rejection causes.
  if (text(raw.codigoIbge).replace(/\D/g, "").length !== 7) {
    return "Código IBGE do município deve ter 7 dígitos";
  }
  return null;
}

// GET /v1/fiscal/settings
export const getFiscalSettingsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const ctx = await requireFiscalAdmin(req, res);
    if (!ctx) return;

    const settings = await getFiscalSettings(ctx.tenantId);
    res.status(200).json(toPublicSettings(settings));
  } catch (error) {
    const err = error as Error;
    logger.error("Falha ao buscar configuração fiscal", { error: err.message });
    res.status(mapFiscalErrorStatus(err)).json({ message: err.message });
  }
};

// PUT /v1/fiscal/settings
export const saveFiscalSettingsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const ctx = await requireFiscalAdmin(req, res);
    if (!ctx) return;

    const body = req.body as Record<string, unknown>;

    const cnpj = text(body.cnpj).replace(/\D/g, "");
    if (cnpj.length !== 14) {
      res.status(400).json({ message: "CNPJ do emitente é inválido" });
      return;
    }

    const razaoSocial = text(body.razaoSocial);
    if (!razaoSocial) {
      res.status(400).json({ message: "Razão social é obrigatória" });
      return;
    }

    const email = text(body.email);
    if (!email.includes("@")) {
      res.status(400).json({ message: "E-mail do emitente é inválido" });
      return;
    }

    const regimeTributario = Number(body.regimeTributario) as FiscalTaxRegime;
    if (!VALID_REGIMES.includes(regimeTributario)) {
      res.status(400).json({
        message: "Regime tributário inválido (1 Simples, 2 Simples excesso, 3 Normal, 4 MEI)",
      });
      return;
    }

    const addressError = validateAddress(body.endereco as AddressInput | undefined);
    if (addressError) {
      res.status(400).json({ message: addressError });
      return;
    }

    const habilitaNfe = body.habilitaNfe === true;
    const habilitaNfse = body.habilitaNfse === true;
    if (!habilitaNfe && !habilitaNfse) {
      res.status(400).json({ message: "Habilite ao menos um tipo de nota (NF-e ou NFS-e)" });
      return;
    }

    // NFS-e is municipal: without an inscrição municipal the city has nobody to
    // bill the ISS to, and every issue attempt fails at the prefecture.
    const inscricaoMunicipal = text(body.inscricaoMunicipal);
    if (habilitaNfse && !inscricaoMunicipal) {
      res.status(400).json({
        message: "Inscrição municipal é obrigatória para emitir NFS-e",
      });
      return;
    }

    const autoIssueRule = text(body.autoIssueRule) as FiscalAutoIssueRule;
    if (autoIssueRule && !VALID_AUTO_ISSUE.includes(autoIssueRule)) {
      res.status(400).json({ message: "Regra de emissão automática inválida" });
      return;
    }

    const rawAddress = body.endereco as AddressInput;

    const saved = await saveFiscalSettings(ctx.tenantId, {
      // Production is opt-in and only reachable after a test document is
      // authorized, so a save never promotes the environment on its own.
      environment: resolveFiscalEnvironment(text(body.environment)),
      cnpj,
      razaoSocial,
      nomeFantasia: text(body.nomeFantasia),
      inscricaoEstadual: text(body.inscricaoEstadual),
      inscricaoMunicipal,
      cnae: text(body.cnae),
      regimeTributario,
      email,
      telefone: text(body.telefone),
      endereco: {
        logradouro: text(rawAddress.logradouro),
        numero: text(rawAddress.numero),
        complemento: text(rawAddress.complemento),
        bairro: text(rawAddress.bairro),
        municipio: text(rawAddress.municipio),
        codigoIbge: text(rawAddress.codigoIbge).replace(/\D/g, ""),
        uf: text(rawAddress.uf).toUpperCase(),
        cep: text(rawAddress.cep).replace(/\D/g, ""),
      },
      habilitaNfe,
      habilitaNfse,
      serieNfe: body.serieNfe === undefined ? undefined : Number(body.serieNfe),
      proximoNumeroNfe:
        body.proximoNumeroNfe === undefined ? undefined : Number(body.proximoNumeroNfe),
      serieNfse: text(body.serieNfse),
      proximoNumeroNfse:
        body.proximoNumeroNfse === undefined ? undefined : Number(body.proximoNumeroNfse),
      certificadoValidade: text(body.certificadoValidade),
      defaultNaturezaOperacao: text(body.defaultNaturezaOperacao),
      autoIssueRule: autoIssueRule || "manual",
      certificadoSenha: text(body.certificadoSenha) || undefined,
    });

    res.status(200).json(toPublicSettings(saved));
  } catch (error) {
    const err = error as Error;
    logger.error("Falha ao salvar configuração fiscal", { error: err.message });
    res.status(mapFiscalErrorStatus(err)).json({ message: err.message });
  }
};

// GET /v1/fiscal/cnpj/:cnpj
export const lookupCnpjHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const ctx = await requireFiscalAdmin(req, res);
    if (!ctx) return;

    const cnpj = String(req.params.cnpj || "").replace(/\D/g, "");
    if (cnpj.length !== 14) {
      res.status(400).json({ message: "CNPJ inválido" });
      return;
    }

    const settings = await getFiscalSettings(ctx.tenantId);
    const provider = getFiscalProvider(settings?.provider);
    const env = resolveFiscalEnvironment(settings?.environment);

    res.status(200).json(await provider.lookupCnpj(cnpj, env));
  } catch (error) {
    const detail = describeFocusError(error);
    logger.warn("Consulta de CNPJ falhou", {
      codigo: detail.codigo,
      httpStatus: detail.httpStatus,
      error: detail.message,
    });
    // A failed lookup is a convenience miss, not a blocker — the wizard falls
    // back to manual entry rather than stopping the user.
    res.status(detail.httpStatus === 404 ? 404 : 502).json({ message: detail.message });
  }
};

// POST /v1/fiscal/issuer
export const registerIssuerHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const ctx = await requireFiscalAdmin(req, res);
    if (!ctx) return;

    const settings = await getFiscalSettings(ctx.tenantId);
    if (!settings) {
      res.status(404).json({ message: "Configure os dados fiscais antes de registrar o emitente" });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const certificadoBase64 = text(body.certificadoBase64);
    if (!certificadoBase64) {
      res.status(400).json({ message: "Envie o certificado digital A1 (.pfx) em base64" });
      return;
    }

    // The password may come with this request or already be on file from a
    // previous registration; the certificate itself is never stored.
    const certificadoSenha =
      text(body.certificadoSenha) || (await getCertificatePassword(ctx.tenantId)) || "";
    if (!certificadoSenha) {
      res.status(400).json({ message: "Informe a senha do certificado digital" });
      return;
    }

    const dryRun = body.dryRun === true;
    const provider = getFiscalProvider(settings.provider);
    const env = resolveFiscalEnvironment(settings.environment);
    const issuerConfig = buildIssuerConfig(settings, certificadoBase64, certificadoSenha);

    const result = await provider.registerIssuer(issuerConfig, env);

    if (dryRun) {
      res.status(200).json({ ...result, dryRun: true });
      return;
    }

    // `registered` — not `ready`. Only an authorized test document proves the
    // company is actually credentialed with the SEFAZ or the municipality.
    await saveFiscalSettings(ctx.tenantId, {
      ...settings,
      providerIssuerId: result.providerIssuerId,
      certificadoSenha,
    });
    await setFiscalStatus(ctx.tenantId, "registered");

    res.status(200).json(result);
  } catch (error) {
    const detail = describeFocusError(error);
    const ctxTenant = req.user?.tenantId;
    if (ctxTenant) {
      await setFiscalStatus(ctxTenant, "error", detail.message).catch(() => undefined);
    }
    logger.error("Falha ao registrar emitente fiscal", {
      codigo: detail.codigo,
      httpStatus: detail.httpStatus,
      error: detail.message,
    });
    res.status(detail.httpStatus && detail.httpStatus < 500 ? 422 : 502).json({
      message: detail.message,
      ...(detail.fieldErrors ? { erros: detail.fieldErrors } : {}),
    });
  }
};

// POST /v1/fiscal/ncm-suggestions
//
// Reaproveita a cota mensal, o rate limiter e o gate de plano da Lia — nao ha
// razao para o modulo fiscal ter contabilidade de IA propria. A sugestao nunca
// e aplicada sozinha: a classificacao fiscal e responsabilidade do cliente, o
// modelo propoe e um humano confirma.
export const suggestNcmHandler = async (req: Request, res: Response): Promise<void> => {
  const user = req.user;
  if (!user?.uid || !user?.tenantId) {
    res.status(401).json({ message: "Não autenticado" });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const nome = typeof body.nome === "string" ? sanitizeText(body.nome) : "";
  if (!nome.trim()) {
    res.status(400).json({ message: "Informe o nome do produto" });
    return;
  }

  const planProfile = await getTenantPlanProfile(user.tenantId);
  if (!NCM_AI_PLANS.has(planProfile.tier)) {
    // Degrada para digitacao manual, que segue disponivel em qualquer plano.
    res.status(403).json({
      message: "Sugestão de NCM por IA está disponível nos planos Pro e Enterprise.",
      code: "AI_PLAN_NOT_ALLOWED",
      tier: planProfile.tier,
    });
    return;
  }

  const limitCheck = await checkAiLimit(
    user.tenantId,
    planProfile.tier as "pro" | "enterprise",
  );
  if (!limitCheck.allowed) {
    res.status(429).json({
      message: "Limite mensal de mensagens de IA atingido.",
      code: "AI_LIMIT_EXCEEDED",
      resetAt: limitCheck.resetAt,
    });
    return;
  }

  await reserveAiMessage(user.tenantId);

  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      await refundAiMessage(user.tenantId);
      res.status(503).json({ message: "Provedor de IA não configurado." });
      return;
    }

    const prompt = buildNcmPrompt({
      nome,
      descricao: typeof body.descricao === "string" ? sanitizeText(body.descricao) : undefined,
      categoria: typeof body.categoria === "string" ? sanitizeText(body.categoria) : undefined,
      fabricante: typeof body.fabricante === "string" ? sanitizeText(body.fabricante) : undefined,
    });

    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: NCM_SYSTEM_PROMPT,
        maxOutputTokens: NCM_MAX_OUTPUT_TOKENS,
        // Classificacao fiscal nao quer criatividade.
        temperature: 0.1,
      },
    });

    const suggestions = parseNcmSuggestions(response.text ?? "");
    await finalizeTokenUsage(user.tenantId, response.usageMetadata?.totalTokenCount ?? 0);

    logger.info("Sugestão de NCM gerada", {
      tenantId: user.tenantId,
      uid: user.uid,
      total: suggestions.length,
    });

    res.status(200).json({ suggestions });
  } catch (error) {
    await refundAiMessage(user.tenantId).catch(() => undefined);
    const err = error as Error;
    logger.error("Falha ao sugerir NCM", { tenantId: user.tenantId, error: err.message });
    res.status(502).json({ message: "Não foi possível sugerir o NCM agora.", code: "AI_ERROR" });
  }
};
