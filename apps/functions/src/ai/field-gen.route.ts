import { Router, type Request, type Response } from "express";
import { GoogleGenAI } from "@google/genai";
import { getTenantPlanProfile, evaluateSubscriptionStatusAccess } from "../lib/tenant-plan-policy";
import { checkAiLimit, reserveAiMessage, finalizeTokenUsage, refundAiMessage } from "./usage-tracker";
import { sanitizeText } from "../utils/sanitize";
import { logger } from "../lib/logger";
import { fieldGenRateLimiter } from "./field-gen-rate-limiter";
import {
  buildPrompt,
  containsInjection,
  MAX_OUTPUT_TOKENS,
  type GenerateFieldRequest,
} from "./prompts/field-generation";

const router = Router();

// Pro+ gate — starter and free cannot use field generation
const ALLOWED_PLANS = new Set<string>(["pro", "enterprise"]);

const MAX_CONTEXT_STRING_LEN = 500;

function sanitizeContext(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") {
      const limit = k === "currentContent" ? 1000 : MAX_CONTEXT_STRING_LEN;
      const clean = sanitizeText(v).slice(0, limit);
      out[k] = clean;
    } else if (typeof v === "number") {
      out[k] = v;
    } else if (Array.isArray(v)) {
      out[k] = v.slice(0, 10).map((item) =>
        typeof item === "object" && item !== null
          ? sanitizeContext(item as Record<string, unknown>)
          : item
      );
    } else {
      out[k] = v;
    }
  }
  return out;
}

router.post("/generate-field", fieldGenRateLimiter, async (req: Request, res: Response): Promise<void> => {
  const user = req.user;
  if (!user?.uid || !user?.tenantId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const body = req.body as { field?: string; context?: Record<string, unknown> };
  const field = typeof body?.field === "string" ? body.field : "";
  const rawContext = typeof body?.context === "object" && body.context !== null ? body.context : {};

  // Validate field is supported
  const SUPPORTED_FIELDS = new Set([
    "product.description",
    "product.category",
    "proposal.notes",
    "proposal.pdfSection",
    "item.description",
  ]);
  if (!field || !SUPPORTED_FIELDS.has(field)) {
    res.status(400).json({ message: "Campo 'field' inválido ou não suportado.", code: "INVALID_FIELD" });
    return;
  }

  // Sanitize context strings and check for injection
  const context = sanitizeContext(rawContext);
  const contextJson = JSON.stringify(context);
  if (containsInjection(contextJson)) {
    logger.warn("AI field-gen: prompt injection attempt blocked", { uid: user.uid, tenantId: user.tenantId, field });
    res.status(400).json({ message: "Conteúdo inválido no contexto.", code: "INVALID_CONTEXT" });
    return;
  }

  // Resolve plan
  let planProfile;
  try {
    planProfile = await getTenantPlanProfile(user.tenantId);
  } catch {
    res.status(500).json({ message: "Erro ao resolver plano do tenant." });
    return;
  }

  // Block free and starter
  if (!ALLOWED_PLANS.has(planProfile.tier)) {
    logger.warn("AI field-gen blocked: plan not allowed", { tenantId: user.tenantId, tier: planProfile.tier });
    res.status(403).json({
      message: "Geração com IA está disponível apenas nos planos Pro e Enterprise.",
      code: "AI_PLAN_NOT_ALLOWED",
      tier: planProfile.tier,
    });
    return;
  }

  // Block inactive subscriptions
  const subscriptionAccess = evaluateSubscriptionStatusAccess({
    subscriptionStatus: planProfile.subscriptionStatus,
    pastDueSince: planProfile.pastDueSince,
  });
  if (!subscriptionAccess.allowWrite) {
    res.status(403).json({
      message: "Assinatura inativa. Regularize para continuar usando a IA.",
      code: "AI_SUBSCRIPTION_INACTIVE",
    });
    return;
  }

  // Check monthly quota
  const limitCheck = await checkAiLimit(user.tenantId, planProfile.tier as "pro" | "enterprise");
  if (!limitCheck.allowed) {
    res.status(429).json({
      message: "Limite mensal de mensagens atingido.",
      code: "AI_LIMIT_EXCEEDED",
      messagesUsed: limitCheck.messagesUsed,
      messagesLimit: limitCheck.messagesLimit,
      resetAt: limitCheck.resetAt,
    });
    return;
  }

  // Reserve a message slot (increments counter)
  await reserveAiMessage(user.tenantId);

  let tokensUsed = 0;
  try {
    const genReq = { field, context } as GenerateFieldRequest;
    const { system, user: userPrompt } = buildPrompt(genReq);
    const maxTokens = MAX_OUTPUT_TOKENS[field as keyof typeof MAX_OUTPUT_TOKENS] ?? 200;

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      await refundAiMessage(user.tenantId);
      res.status(500).json({ message: "Provedor de IA não configurado." });
      return;
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: system,
        maxOutputTokens: maxTokens,
        temperature: 0.7,
      },
    });

    const value = response.text?.trim() ?? "";
    tokensUsed = response.usageMetadata?.totalTokenCount ?? 0;

    if (!value) {
      await refundAiMessage(user.tenantId);
      res.status(502).json({ message: "O modelo não retornou conteúdo.", code: "AI_EMPTY_RESPONSE" });
      return;
    }

    await finalizeTokenUsage(user.tenantId, tokensUsed);

    logger.info("AI field-gen success", {
      tenantId: user.tenantId,
      uid: user.uid,
      field,
      tokensUsed,
      model: "gemini-2.5-flash-lite",
    });

    res.status(200).json({
      value,
      tokensUsed,
      remainingMessages: Math.max(0, limitCheck.messagesLimit - limitCheck.messagesUsed - 1),
    });
  } catch (err) {
    await refundAiMessage(user.tenantId).catch(() => {});
    logger.error("AI field-gen error", { tenantId: user.tenantId, uid: user.uid, field, error: String(err) });
    throw err; // let global error handler report to Sentry
  }
});

export { router as fieldGenRouter };
