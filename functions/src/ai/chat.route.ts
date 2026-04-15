import { Router, type Request, type Response } from "express";
import { GoogleGenerativeAI, type FunctionResponsePart, type FunctionDeclarationsTool } from "@google/generative-ai";
import Groq from "groq-sdk";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "../init";
import { getTenantPlanProfile, evaluateSubscriptionStatusAccess } from "../lib/tenant-plan-policy";
import { sanitizeText } from "../utils/sanitize";
import { logger } from "../lib/logger";
import { selectModel } from "./model-router";
import { checkAiLimit, incrementAiUsage, getAiUsage } from "./usage-tracker";
import { loadConversation, saveConversation } from "./conversation-store";
import { buildSystemPrompt } from "./context-builder";
import { buildAvailableTools } from "./tools/index";
import { executeToolCall, type ToolCallContext } from "./tools/executor";
import type { AiChatRequest, AiChatChunk, AiConversationMessage } from "./ai.types";

const router = Router();

/**
 * Convert Gemini FunctionDeclarationsTool[] to Groq/OpenAI ChatCompletionTool[] format.
 * Used when GROQ_API_KEY is set (local development only).
 */
function geminiToolsToGroqFormat(
  geminiTools: FunctionDeclarationsTool[],
): Groq.Chat.Completions.ChatCompletionTool[] {
  const result: Groq.Chat.Completions.ChatCompletionTool[] = [];
  for (const tool of geminiTools) {
    for (const fn of tool.functionDeclarations ?? []) {
      result.push({
        type: "function",
        function: {
          name: fn.name,
          description: fn.description ?? "",
          parameters: (fn.parameters ?? { type: "object", properties: {} }) as Record<string, unknown>,
        },
      });
    }
  }
  return result;
}

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
    res.status(403).json({
      message: "Plano Free não tem acesso à Lia. Faça upgrade para Starter ou superior.",
      code: "AI_FREE_TIER_BLOCKED",
    });
    return;
  }

  // 3b. Block inactive subscriptions (canceled, past_due beyond grace)
  const subscriptionAccess = evaluateSubscriptionStatusAccess({
    subscriptionStatus: planProfile.subscriptionStatus,
    pastDueSince: planProfile.pastDueSince,
  });
  if (!subscriptionAccess.allowWrite) {
    res.status(403).json({
      message: "Assinatura inativa. Regularize seu plano para usar a Lia.",
      code: "AI_SUBSCRIPTION_INACTIVE",
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

  // 5. Select model (used for Gemini only; Groq uses llama-3.3-70b-versatile)
  const modelSelection = selectModel(planTier, message);

  // 6. Load conversation history
  const history = await loadConversation(user.tenantId, sessionId, planTier);

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
  const tools = buildAvailableTools(planTier, user.role || "member", { whatsappEnabled });

  // 8. Select provider: GROQ_API_KEY → Groq (dev); else GEMINI_API_KEY → Gemini (prod)
  const groqApiKey = process.env.GROQ_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!groqApiKey && !geminiApiKey) {
    logger.error("No AI API key configured (GROQ_API_KEY or GEMINI_API_KEY)", { tenantId: user.tenantId });
    res.status(500).json({ message: "Serviço de IA não configurado." });
    return;
  }

  // Build tool call context — all fields from auth context, never from request body
  const toolCtx: ToolCallContext = {
    tenantId: user.tenantId,
    uid: user.uid,
    role: user.role || "member",
    planTier,
    confirmed: body.confirmed,
  };

  try {
    // 9. Set SSE headers — disable timeout for long-lived streaming connection
    res.setTimeout(0);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    let skipIncrement = false;
    let fullResponseText = "";
    let totalTokens = 0;

    if (groqApiKey) {
      // ── 10a. Groq streaming path (local development) ──────────────────────
      const groqClient = new Groq({ apiKey: groqApiKey });
      const groqTools = geminiToolsToGroqFormat(tools);

      type GroqMessage = Groq.Chat.Completions.ChatCompletionMessageParam;
      const messages: GroqMessage[] = [
        { role: "system", content: systemPrompt },
        ...history.map((msg) => ({
          role: msg.role === "model" ? ("assistant" as const) : ("user" as const),
          content: msg.content,
        })),
        { role: "user", content: message },
      ];

      const MAX_TOOL_ROUNDS = 5;
      let toolRound = 0;

      while (toolRound < MAX_TOOL_ROUNDS) {
        const stream = await groqClient.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages,
          tools: groqTools.length > 0 ? groqTools : undefined,
          tool_choice: groqTools.length > 0 ? "auto" : undefined,
          stream: true,
        });

        interface ToolCallAcc { id: string; name: string; arguments: string }
        const pendingToolCalls: ToolCallAcc[] = [];
        let assistantContent = "";

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;

          if (delta?.content) {
            assistantContent += delta.content;
            fullResponseText += delta.content;
            const sseChunk: AiChatChunk = { type: "text", content: delta.content };
            res.write(`data: ${JSON.stringify(sseChunk)}\n\n`);
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              if (!pendingToolCalls[idx]) {
                pendingToolCalls[idx] = { id: "", name: "", arguments: "" };
              }
              if (tc.id) pendingToolCalls[idx].id = tc.id;
              if (tc.function?.name) pendingToolCalls[idx].name = tc.function.name;
              if (tc.function?.arguments) pendingToolCalls[idx].arguments += tc.function.arguments;
            }
          }

        }

        const completedToolCalls = pendingToolCalls.filter((tc) => tc.name);
        if (completedToolCalls.length === 0) break;

        // Add assistant turn with tool calls to message history
        messages.push({
          role: "assistant",
          content: assistantContent || null,
          tool_calls: completedToolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: { name: tc.name, arguments: tc.arguments },
          })),
        });

        let exitLoop = false;
        for (const tc of completedToolCalls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.arguments) as Record<string, unknown>;
          } catch {
            // Malformed JSON args — proceed with empty args
          }

          const toolCallChunk: AiChatChunk = {
            type: "tool_call",
            toolCall: { name: tc.name, args },
          };
          res.write(`data: ${JSON.stringify(toolCallChunk)}\n\n`);

          const result = await executeToolCall(tc.name, args, toolCtx);

          const toolResultChunk: AiChatChunk = {
            type: "tool_result",
            toolResult: {
              name: tc.name,
              result: result.data,
              requiresConfirmation: result.requiresConfirmation,
              confirmationData: result.confirmationData,
            },
          };
          res.write(`data: ${JSON.stringify(toolResultChunk)}\n\n`);

          if (result.requiresConfirmation) {
            skipIncrement = true;
            toolRound = MAX_TOOL_ROUNDS;
            exitLoop = true;
            break;
          }

          const responseObj: object = result.success
            ? ((result.data as object) ?? { status: "ok" })
            : { error: result.error ?? "unknown error" };

          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(responseObj),
          });
        }

        if (exitLoop) break;
        toolRound++;
      }
      // ── End Groq path ─────────────────────────────────────────────────────
    } else {
      // ── 10b. Gemini streaming path (production) ───────────────────────────
      const genAI = new GoogleGenerativeAI(geminiApiKey as string);
      const model = genAI.getGenerativeModel({
        model: modelSelection.modelName,
        systemInstruction: systemPrompt,
        tools: tools.length > 0 ? tools : undefined,
      });

      // Build Gemini history from persisted conversation messages
      const geminiHistory = history.map((msg) => ({
        role: msg.role === "model" ? ("model" as const) : ("user" as const),
        parts: [{ text: msg.content }],
      }));

      const chat = model.startChat({ history: geminiHistory });
      let currentStream = await chat.sendMessageStream(message);

      const MAX_TOOL_ROUNDS = 5;
      let toolRound = 0;

      while (toolRound < MAX_TOOL_ROUNDS) {
        const pendingToolCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

        for await (const chunk of currentStream.stream) {
          const text = chunk.text();
          if (text) {
            fullResponseText += text;
            const sseChunk: AiChatChunk = { type: "text", content: text };
            res.write(`data: ${JSON.stringify(sseChunk)}\n\n`);
          }

          const candidates = chunk.candidates;
          if (candidates) {
            for (const candidate of candidates) {
              const parts = candidate.content?.parts;
              if (parts) {
                for (const part of parts) {
                  if ("functionCall" in part && part.functionCall) {
                    pendingToolCalls.push({
                      name: part.functionCall.name,
                      args: (part.functionCall.args as Record<string, unknown>) || {},
                    });
                  }
                }
              }
            }
          }
        }

        if (pendingToolCalls.length === 0) break;

        const functionResponseParts: FunctionResponsePart[] = [];

        for (const tc of pendingToolCalls) {
          const toolCallChunk: AiChatChunk = {
            type: "tool_call",
            toolCall: { name: tc.name, args: tc.args },
          };
          res.write(`data: ${JSON.stringify(toolCallChunk)}\n\n`);

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
          res.write(`data: ${JSON.stringify(toolResultChunk)}\n\n`);

          if (result.requiresConfirmation) {
            skipIncrement = true;
            const usageResponse = await currentStream.response;
            totalTokens = usageResponse.usageMetadata?.totalTokenCount || 0;
            toolRound = MAX_TOOL_ROUNDS;
            break;
          }

          const responseObj: object = result.success
            ? ((result.data as object) ?? { status: "ok" })
            : { error: result.error ?? "unknown error" };
          functionResponseParts.push({
            functionResponse: {
              name: tc.name,
              response: responseObj,
            },
          });
        }

        if (toolRound >= MAX_TOOL_ROUNDS) break;

        currentStream = await chat.sendMessageStream(functionResponseParts);
        toolRound++;
      }

      if (toolRound < MAX_TOOL_ROUNDS) {
        const usageMetadata = await currentStream.response;
        totalTokens = usageMetadata.usageMetadata?.totalTokenCount || 0;
      }
      // ── End Gemini path ───────────────────────────────────────────────────
    }

    if (!skipIncrement) {
      // 11. Increment usage atomically
      await incrementAiUsage(user.tenantId, totalTokens);

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
        },
      };
      res.write(`data: ${JSON.stringify(usageChunk)}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    } else {
      // Confirmation pending — do not increment usage or save incomplete conversation
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

    if (!res.headersSent) {
      res.status(500).json({ message: "Erro ao processar resposta da IA.", reply: "" });
      return;
    }

    const errorChunk: AiChatChunk = { type: "error", error: "Erro ao processar resposta da IA." };
    res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

export const aiRouter = router;
