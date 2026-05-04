import { Router, type Request, type Response } from "express";
import { type FunctionDeclarationsTool } from "@google/generative-ai";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "../init";
import { getTenantPlanProfile, evaluateSubscriptionStatusAccess } from "../lib/tenant-plan-policy";
import { sanitizeText } from "../utils/sanitize";
import { logger } from "../lib/logger";
import { selectModel } from "./model-router";
import { checkAiLimit, reserveAiMessage, finalizeTokenUsage, refundAiMessage, getAiUsage } from "./usage-tracker";
import { loadConversation, saveConversation } from "./conversation-store";
import { buildSystemPrompt } from "./context-builder";
import { buildAvailableTools } from "./tools/index";
import { executeToolCall, type ToolCallContext } from "./tools/executor";
import { createAiProvider, createGroqFallbackProvider, type ToolFeedback } from "./providers/index";
import { validateConfirmationToken } from "./security/confirmation-token";
import type { AiChatRequest, AiChatChunk, AiConversationMessage } from "./ai.types";

const router = Router();

router.post("/chat", async (req: Request, res: Response): Promise<void> => {
  const user = req.user;
  if (!user?.uid || !user?.tenantId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  // 1. Parse and validate request body
  const body = req.body as AiChatRequest;
  const rawMessage = typeof body?.message === "string" ? body.message.trim() : "";
  if (!rawMessage) {
    res.status(400).json({ message: "Campo 'message' é obrigatório." });
    return;
  }
  if (rawMessage.length > 4000) {
    res.status(400).json({ message: "Mensagem excede o limite de 4000 caracteres." });
    return;
  }

  const message = sanitizeText(rawMessage);
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const currentPath = typeof body.currentPath === "string" ? body.currentPath : undefined;
  const confirmationToken =
    typeof body.confirmationToken === "string" ? body.confirmationToken.trim() : undefined;

  // 2. Resolve plan tier
  let planProfile;
  try {
    planProfile = await getTenantPlanProfile(user.tenantId);
  } catch {
    res.status(500).json({ message: "Erro ao resolver plano do tenant." });
    return;
  }

  // 3. Block free tier with 403
  if (planProfile.tier === "free") {
    logger.warn("AI chat blocked: free tier", {
      tenantId: user.tenantId,
      uid: user.uid,
      tier: planProfile.tier,
      subscriptionStatus: planProfile.subscriptionStatus,
      source: planProfile.source,
    });
    res.status(403).json({
      message: "Plano Free não tem acesso à Lia. Faça upgrade para Starter ou superior.",
      code: "AI_FREE_TIER_BLOCKED",
      tier: planProfile.tier,
      source: planProfile.source,
    });
    return;
  }

  // 3b. Block inactive subscriptions (canceled, past_due beyond grace)
  const subscriptionAccess = evaluateSubscriptionStatusAccess({
    subscriptionStatus: planProfile.subscriptionStatus,
    pastDueSince: planProfile.pastDueSince,
  });
  if (!subscriptionAccess.allowWrite) {
    logger.warn("AI chat blocked: subscription inactive", {
      tenantId: user.tenantId,
      uid: user.uid,
      tier: planProfile.tier,
      subscriptionStatus: planProfile.subscriptionStatus,
      reasonCode: subscriptionAccess.reasonCode,
      source: planProfile.source,
    });
    res.status(403).json({
      message: "Assinatura inativa. Regularize seu plano para usar a Lia.",
      code: "AI_SUBSCRIPTION_INACTIVE",
      reasonCode: subscriptionAccess.reasonCode,
      subscriptionStatus: planProfile.subscriptionStatus,
    });
    return;
  }

  const planTier = planProfile.tier;

  // 4. Check monthly limit
  const limitCheck = await checkAiLimit(user.tenantId, planTier);
  if (!limitCheck.allowed) {
    res.status(429).json({
      message: `Limite de mensagens atingido (${limitCheck.messagesUsed}/${limitCheck.messagesLimit}). Resets em ${limitCheck.resetAt}.`,
      code: "AI_LIMIT_EXCEEDED",
      messagesUsed: limitCheck.messagesUsed,
      messagesLimit: limitCheck.messagesLimit,
      resetAt: limitCheck.resetAt,
    });
    return;
  }

  // 4b. Pre-debit: reserve 1 message slot before streaming begins.
  // If the stream errors, is canceled, or returns a confirmation request,
  // the slot is refunded in the finally block below.
  let messageReserved = false;
  try {
    await reserveAiMessage(user.tenantId);
    messageReserved = true;
  } catch {
    res.status(500).json({ message: "Erro interno ao processar solicitação." });
    return;
  }

  // 5. Select model (used for Gemini only; Groq uses llama-3.3-70b-versatile)
  const modelSelection = selectModel(planTier);
  let actualModelName = modelSelection.modelName;

  // 6. Load conversation history
  const history = await loadConversation(user.tenantId, sessionId, planTier, user.uid);

  // 7. Build system prompt — fetch tenant name/niche for context
  let tenantName = "";
  let tenantNiche = "";
  let whatsappEnabled = false;
  try {
    const tenantSnap = await db.collection("tenants").doc(user.tenantId).get();
    if (tenantSnap.exists) {
      const tenantData = tenantSnap.data() as Record<string, unknown>;
      tenantName = String(tenantData?.name || "");
      tenantNiche = String(tenantData?.niche || "");
      whatsappEnabled = Boolean(tenantData?.whatsappEnabled);
    }
  } catch {
    // Non-fatal — continue with empty tenant info
  }

  const systemPrompt = buildSystemPrompt({
    tenantId: user.tenantId,
    tenantName,
    tenantNiche,
    planTier,
    userName: user.email || "Usuário",
    userRole: user.role || "member",
    currentPath,
    aiUsage: {
      messagesUsed: limitCheck.messagesUsed,
      messagesLimit: limitCheck.messagesLimit,
    },
  });

  // Build available tools for this tenant's plan/role/modules
  const tools: FunctionDeclarationsTool[] = buildAvailableTools(planTier, user.role || "member", {
    whatsappEnabled,
  });

  // 8. Select provider: AI_PROVIDER=mock > GEMINI_API_KEY > GROQ_API_KEY
  const groqApiKey = process.env.GROQ_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const isMock = process.env.AI_PROVIDER === "mock";

  if (!isMock && !groqApiKey && !geminiApiKey) {
    logger.error("No AI API key configured (GROQ_API_KEY or GEMINI_API_KEY)", {
      tenantId: user.tenantId,
    });
    res.status(500).json({ message: "Serviço de IA não configurado." });
    return;
  }

  // Resolve confirmation: token takes priority over deprecated boolean flag.
  // Token is validated against sessionId to prevent cross-session replay.
  let isConfirmed = false;
  if (confirmationToken && sessionId) {
    isConfirmed = validateConfirmationToken(confirmationToken, sessionId);
    if (!isConfirmed) {
      logger.warn("Invalid or expired confirmation token", {
        tenantId: user.tenantId,
        uid: user.uid,
      });
    }
  } else if (body.confirmed === true) {
    // DEPRECATED — kept for backward compatibility, remove after next release
    isConfirmed = true;
  }

  // Build tool call context — all fields from auth context, never from request body
  const toolCtx: ToolCallContext = {
    tenantId: user.tenantId,
    uid: user.uid,
    role: user.role || "member",
    planTier,
    confirmed: isConfirmed,
    sessionId: sessionId || undefined,
  };

  // Heartbeat: keep the connection alive across proxies/load-balancers
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

  try {
    // 9. Set SSE headers — disable timeout for long-lived streaming connection
    res.setTimeout(0);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // Start heartbeat after headers are flushed — send SSE comment every 20 s
    heartbeatTimer = setInterval(() => {
      if (!res.writableEnded) res.write(": heartbeat\n\n");
    }, 20_000);

    let skipIncrement = false;
    let fullResponseText = "";
    let totalTokens = 0;
    // Tracks whether any SSE data has been written — used to decide if Groq fallback is safe
    let contentWritten = false;

    const writeSSE = (data: string): void => {
      contentWritten = true;
      res.write(data);
    };

    /**
     * Core tool-calling loop using the provider abstraction.
     * Handles multi-round tool execution up to MAX_TOOL_ROUNDS.
     */
    const runProviderLoop = async (
      providerGeminiKey?: string,
      providerGroqKey?: string,
    ): Promise<void> => {
      const provider = createAiProvider({
        geminiApiKey: providerGeminiKey,
        groqApiKey: providerGroqKey,
      });
      const session = provider.createSession({
        systemPrompt,
        history,
        tools,
        modelName: modelSelection.modelName,
      });

      const MAX_TOOL_ROUNDS = 5;
      const MAX_TOOL_CALLS_PER_ROUND = 10;
      let toolRound = 0;
      let currentInput: string | ToolFeedback[] = message;

      while (toolRound < MAX_TOOL_ROUNDS) {
        let pendingToolCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

        for await (const event of session.streamTurn(currentInput)) {
          if (event.type === "text") {
            fullResponseText += event.content;
            const sseChunk: AiChatChunk = { type: "text", content: event.content };
            writeSSE(`data: ${JSON.stringify(sseChunk)}\n\n`);
          } else if (event.type === "thinking") {
            const thinkingChunk: AiChatChunk = { type: "thinking" };
            writeSSE(`data: ${JSON.stringify(thinkingChunk)}\n\n`);
          } else if (event.type === "tool_calls") {
            pendingToolCalls = event.calls;
          } else if (event.type === "done") {
            totalTokens = event.totalTokens;
          }
        }

        // Safety cap: prevent runaway tool execution per round
        if (pendingToolCalls.length > MAX_TOOL_CALLS_PER_ROUND) {
          logger.warn(`AI tool calls per round capped (${pendingToolCalls.length} → ${MAX_TOOL_CALLS_PER_ROUND})`, {
            tenantId: user.tenantId,
          });
          pendingToolCalls = pendingToolCalls.slice(0, MAX_TOOL_CALLS_PER_ROUND);
        }

        if (pendingToolCalls.length === 0) break;

        const toolFeedbacks: ToolFeedback[] = [];
        let exitLoop = false;

        for (const tc of pendingToolCalls) {
          const toolCallChunk: AiChatChunk = {
            type: "tool_call",
            toolCall: { name: tc.name, args: tc.args },
          };
          writeSSE(`data: ${JSON.stringify(toolCallChunk)}\n\n`);

          const result = await executeToolCall(tc.name, tc.args, toolCtx);

          const toolResultChunk: AiChatChunk = {
            type: "tool_result",
            toolResult: {
              name: tc.name,
              result: result.data,
              requiresConfirmation: result.requiresConfirmation,
              confirmationToken: result.confirmationToken,
              confirmationData: result.confirmationData,
            },
          };
          writeSSE(`data: ${JSON.stringify(toolResultChunk)}\n\n`);

          if (result.requiresConfirmation) {
            skipIncrement = true;
            exitLoop = true;
            break;
          }

          const rawData = result.success ? (result.data ?? { status: "ok" }) : { error: result.error ?? "unknown error" };
          // Gemini's function_response.response uses google.protobuf.Struct which only accepts JSON objects, not arrays
          const responseObj: object = Array.isArray(rawData) ? { items: rawData } : (rawData as object);

          toolFeedbacks.push({ name: tc.name, response: responseObj });
        }

        if (exitLoop) break;
        currentInput = toolFeedbacks;
        toolRound++;
      }
    };

    // 10. Run the provider loop
    // Priority: mock > Gemini (with Groq fallback on 429 in emulator/localhost only) > Groq only
    try {
      await runProviderLoop(geminiApiKey, groqApiKey);
    } catch (primaryError) {
      const errorMsg = primaryError instanceof Error ? primaryError.message : "";
      // Gemini 429 → transparent Groq fallback (emulator/localhost only, no content written yet)
      if (
        errorMsg.includes("429") &&
        groqApiKey &&
        !contentWritten &&
        process.env.FUNCTIONS_EMULATOR === "true"
      ) {
        logger.warn("Gemini rate-limited, falling back to Groq for this request", {
          tenantId: user.tenantId,
        });
        actualModelName = "llama-3.3-70b-versatile";
        const fallbackProvider = createGroqFallbackProvider(groqApiKey);
        const session = fallbackProvider.createSession({
          systemPrompt,
          history,
          tools,
          modelName: modelSelection.modelName,
        });

        const MAX_TOOL_ROUNDS = 5;
        let toolRound = 0;
        let currentInput: string | ToolFeedback[] = message;

        while (toolRound < MAX_TOOL_ROUNDS) {
          let pendingToolCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

          for await (const event of session.streamTurn(currentInput)) {
            if (event.type === "text") {
              fullResponseText += event.content;
              const sseChunk: AiChatChunk = { type: "text", content: event.content };
              writeSSE(`data: ${JSON.stringify(sseChunk)}\n\n`);
            } else if (event.type === "thinking") {
              const thinkingChunk: AiChatChunk = { type: "thinking" };
              writeSSE(`data: ${JSON.stringify(thinkingChunk)}\n\n`);
            } else if (event.type === "tool_calls") {
              pendingToolCalls = event.calls;
            } else if (event.type === "done") {
              totalTokens = event.totalTokens;
            }
          }

          if (pendingToolCalls.length === 0) break;

          const toolFeedbacks: ToolFeedback[] = [];
          let exitLoop = false;

          for (const tc of pendingToolCalls) {
            const toolCallChunk: AiChatChunk = {
              type: "tool_call",
              toolCall: { name: tc.name, args: tc.args },
            };
            writeSSE(`data: ${JSON.stringify(toolCallChunk)}\n\n`);

            const result = await executeToolCall(tc.name, tc.args, toolCtx);

            const toolResultChunk: AiChatChunk = {
              type: "tool_result",
              toolResult: {
                name: tc.name,
                result: result.data,
                requiresConfirmation: result.requiresConfirmation,
                confirmationData: result.confirmationData,
              },
            };
            writeSSE(`data: ${JSON.stringify(toolResultChunk)}\n\n`);

            if (result.requiresConfirmation) {
              skipIncrement = true;
              exitLoop = true;
              break;
            }

            const rawData = result.success ? (result.data ?? { status: "ok" }) : { error: result.error ?? "unknown error" };
            // Gemini's function_response.response uses google.protobuf.Struct which only accepts JSON objects, not arrays
            const responseObj: object = Array.isArray(rawData) ? { items: rawData } : (rawData as object);

            toolFeedbacks.push({ name: tc.name, response: responseObj });
          }

          if (exitLoop) break;
          currentInput = toolFeedbacks;
          toolRound++;
        }
      } else {
        throw primaryError;
      }
    }

    if (!skipIncrement) {
      logger.info("AI stream complete, persisting usage and conversation", {
        tenantId: user.tenantId,
        uid: user.uid,
        planTier,
        totalTokens,
        responseLength: fullResponseText.length,
      });
      // 11. Finalize token usage (message was pre-debited before stream started)
      await finalizeTokenUsage(user.tenantId, totalTokens);
      messageReserved = false; // Pre-debit consumed — no refund needed

      // 12. Save conversation (Pro/Enterprise only — starter is no-op in saveConversation)
      const now = Timestamp.now();
      const updatedMessages: AiConversationMessage[] = [
        ...history,
        { role: "user" as const, content: message, timestamp: now },
        { role: "model" as const, content: fullResponseText, timestamp: now },
      ];
      await saveConversation(user.tenantId, sessionId, user.uid, updatedMessages, planTier);

      // 13. Send usage event and DONE sentinel
      const currentUsage = await getAiUsage(user.tenantId);
      const usageChunk: AiChatChunk = {
        type: "usage",
        usage: {
          messagesUsed: currentUsage?.messagesUsed || limitCheck.messagesUsed + 1,
          messagesLimit: limitCheck.messagesLimit,
          totalTokensUsed: currentUsage?.totalTokensUsed || totalTokens,
          modelName: actualModelName,
        },
      };
      res.write(`data: ${JSON.stringify(usageChunk)}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    } else {
      // Confirmation pending — refund pre-debit before ending response so that
      // the next request sees the correct usage count immediately.
      try {
        await refundAiMessage(user.tenantId);
        messageReserved = false;
      } catch (err) {
        logger.warn("Failed to refund pre-debited AI message (confirmation pending)", {
          tenantId: user.tenantId,
          error: err instanceof Error ? err.message : "unknown",
        });
      }
      res.write("data: [DONE]\n\n");
      res.end();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro interno da IA";
    logger.error("AI chat stream error", {
      tenantId: user.tenantId,
      uid: user.uid,
      error: errorMessage,
    });

    // Detect AI provider rate limit — Groq errors start with "429", Gemini wraps it as "[GoogleGenerativeAI Error]: ... [429 Too Many Requests]"
    const isProviderRateLimit = typeof errorMessage === "string" && errorMessage.includes("429");
    // Gemini 3 is stricter about function call/response turn ordering — usually caused by a failed tool execution
    const isFunctionTurnError = typeof errorMessage === "string" && errorMessage.includes("function response turn");
    const clientMessage = isProviderRateLimit
      ? "Serviço de IA temporariamente sobrecarregado. Tente novamente em alguns instantes."
      : isFunctionTurnError
      ? "Erro na execução de uma ferramenta. Tente novamente ou inicie uma nova conversa."
      : "Erro ao processar resposta da IA.";

    if (!res.headersSent) {
      res.status(500).json({ message: clientMessage, reply: "" });
      return;
    }

    const errorChunk: AiChatChunk = { type: "error", error: clientMessage };
    res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  } finally {
    clearInterval(heartbeatTimer);
    // Refund the pre-debited message slot when the stream did not complete successfully:
    // - stream error (catch path)
    // - confirmation pending (skipIncrement=true — counter re-reserved on the confirmed request)
    // - client disconnect (write failure)
    if (messageReserved) {
      refundAiMessage(user.tenantId).catch((err) => {
        logger.warn("Failed to refund pre-debited AI message", {
          tenantId: user.tenantId,
          error: err instanceof Error ? err.message : "unknown",
        });
      });
    }
  }
});

export const aiRouter = router;
