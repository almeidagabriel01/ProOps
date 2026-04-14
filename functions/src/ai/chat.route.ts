import { Router, type Request, type Response } from "express";
import { GoogleGenerativeAI, type FunctionResponsePart } from "@google/generative-ai";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "../init";
import { getTenantPlanProfile } from "../lib/tenant-plan-policy";
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

  // 5. Select model
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

  // 8. Initialize Gemini
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    logger.error("GEMINI_API_KEY not configured", { tenantId: user.tenantId });
    res.status(500).json({ message: "Serviço de IA não configurado." });
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
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

  // Build tool call context — all fields from auth context, never from request body
  const toolCtx: ToolCallContext = {
    tenantId: user.tenantId,
    uid: user.uid,
    role: user.role || "member",
    planTier,
    confirmed: body.confirmed, // from AiChatRequest.confirmed (frontend resend)
  };

  try {
    // 9. Set SSE headers — disable timeout for long-lived streaming connection
    res.setTimeout(0);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // 10. Stream Gemini response with tool calling loop
    const chat = model.startChat({ history: geminiHistory });
    let currentStream = await chat.sendMessageStream(message);

    let fullResponseText = "";
    let totalTokens = 0;
    const MAX_TOOL_ROUNDS = 5; // prevent infinite tool calling loops
    let toolRound = 0;

    // Outer loop: handles multi-turn tool calling
    while (toolRound < MAX_TOOL_ROUNDS) {
      const pendingToolCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

      // Inner loop: consume the current stream
      for await (const chunk of currentStream.stream) {
        const text = chunk.text();
        if (text) {
          fullResponseText += text;
          // CORRECT: AiChatChunk.content is the field for text (not "text")
          const sseChunk: AiChatChunk = { type: "text", content: text };
          res.write(`data: ${JSON.stringify(sseChunk)}\n\n`);
        }

        // Collect function calls from this chunk
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

      // If no tool calls in this round, we're done streaming
      if (pendingToolCalls.length === 0) break;

      // Execute each tool call and collect responses
      const functionResponseParts: FunctionResponsePart[] = [];

      for (const tc of pendingToolCalls) {
        // Send tool_call event to SSE client
        const toolCallChunk: AiChatChunk = {
          type: "tool_call",
          toolCall: { name: tc.name, args: tc.args },
        };
        res.write(`data: ${JSON.stringify(toolCallChunk)}\n\n`);

        // Execute the tool
        const result = await executeToolCall(tc.name, tc.args, toolCtx);

        // Send tool_result event to SSE client
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

        // If tool requires confirmation, end the stream here
        // Frontend will show modal, user confirms, frontend resends with confirmed=true
        if (result.requiresConfirmation) {
          // Get usage metadata from the last stream response
          const usageResponse = await currentStream.response;
          totalTokens = usageResponse.usageMetadata?.totalTokenCount || 0;
          // Force exit from the tool round loop
          toolRound = MAX_TOOL_ROUNDS;
          break;
        }

        // Collect function response for Gemini multi-turn
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

      // If we're exiting due to confirmation, don't send another message
      if (toolRound >= MAX_TOOL_ROUNDS) break;

      // Send function responses back to Gemini for the next turn
      currentStream = await chat.sendMessageStream(functionResponseParts);
      toolRound++;
    }

    // Get usage metadata from final stream response
    if (toolRound < MAX_TOOL_ROUNDS) {
      const usageMetadata = await currentStream.response;
      totalTokens = usageMetadata.usageMetadata?.totalTokenCount || 0;
    }

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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro interno da IA";
    logger.error("AI chat stream error", {
      tenantId: user.tenantId,
      uid: user.uid,
      error: errorMessage,
    });

    if (!res.headersSent) {
      // Fallback to JSON if SSE headers not yet flushed
      res.status(500).json({ message: "Erro ao processar resposta da IA.", reply: "" });
      return;
    }

    // Headers already sent — send error via SSE then close
    const errorChunk: AiChatChunk = { type: "error", error: "Erro ao processar resposta da IA." };
    res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

export const aiRouter = router;
