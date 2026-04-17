import { GoogleGenAI } from "@google/genai";
import type { Chat, FunctionCall, GenerateContentResponse, Part } from "@google/genai";
import type { FunctionDeclarationsTool } from "@google/generative-ai";
import type { AiConversationMessage } from "../ai.types";
import type { AiChatSession, AiProvider, ProviderEvent, ToolFeedback } from "./provider.interface";
import { logger } from "../../lib/logger";

class GeminiDeferredSession implements AiChatSession {
  private chat: Chat;
  private started = false;
  // Maps function name → call id from the last tool_calls turn.
  // Gemini 3+ requires echoing back the call id when sending function responses.
  private lastCallIds = new Map<string, string>();

  constructor(chat: Chat) {
    this.chat = chat;
  }

  async *streamTurn(input: string | ToolFeedback[]): AsyncGenerator<ProviderEvent> {
    let message: string | Part[];

    if (!this.started) {
      this.started = true;
      message = typeof input === "string" ? input : "";
    } else if (Array.isArray(input)) {
      // Tool-result turn: SDK wraps these as role:"user" automatically.
      message = (input as ToolFeedback[]).map((fb) => ({
        functionResponse: {
          id: this.lastCallIds.get(fb.name) ?? fb.name,
          name: fb.name,
          response: fb.response as Record<string, unknown>,
        },
      }));
    } else {
      message = input as string;
    }

    this.lastCallIds.clear();

    const stream: AsyncGenerator<GenerateContentResponse> = await this.chat.sendMessageStream({ message });

    let lastChunk: GenerateContentResponse | undefined;
    let totalTokens = 0;
    let chunkCount = 0;
    let textChunkCount = 0;
    let emittedThinking = false;
    // Accumulate function calls from ALL chunks (Gemini 3 may spread across chunks)
    const allFunctionCalls = new Map<string, FunctionCall & { name: string }>();

    for await (const chunk of stream) {
      lastChunk = chunk;
      chunkCount++;

      if (!emittedThinking) {
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (parts?.some(p => p.thought === true)) {
          emittedThinking = true;
          yield { type: "thinking" };
        }
      }

      const text = chunk.text;
      if (text) {
        textChunkCount++;
        yield { type: "text", content: text };
      }

      const chunkFunctionCalls = chunk.functionCalls;
      if (chunkFunctionCalls && chunkFunctionCalls.length > 0) {
        for (const call of chunkFunctionCalls) {
          if (call.name) {
            allFunctionCalls.set(call.name, call as FunctionCall & { name: string });
          }
        }
      }

      if (chunk.usageMetadata?.totalTokenCount) {
        totalTokens = chunk.usageMetadata.totalTokenCount;
      }
    }

    logger.info("Gemini stream turn complete", {
      chunkCount,
      textChunkCount,
      functionCallCount: allFunctionCalls.size,
      totalTokens,
      finishReason: lastChunk?.candidates?.[0]?.finishReason,
    });

    if (allFunctionCalls.size > 0) {
      const validCalls = Array.from(allFunctionCalls.values());
      for (const call of validCalls) {
        this.lastCallIds.set(call.name, call.id ?? call.name);
      }
      yield {
        type: "tool_calls",
        calls: validCalls.map((call) => ({
          name: call.name,
          args: (call.args ?? {}) as Record<string, unknown>,
        })),
      };
    } else if (textChunkCount === 0) {
      logger.warn("Gemini stream produced no text and no function calls", {
        chunkCount,
        finishReason: lastChunk?.candidates?.[0]?.finishReason,
        promptFeedback: lastChunk?.promptFeedback,
      });
    }

    yield { type: "done", totalTokens };
  }
}

export class GeminiProvider implements AiProvider {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  createSession(opts: {
    systemPrompt: string;
    history: AiConversationMessage[];
    tools: FunctionDeclarationsTool[];
    modelName: string;
  }): AiChatSession {
    // Convert @google/generative-ai tool format to @google/genai format.
    // Old field: "parameters" (with SchemaType enum). New field: "parametersJsonSchema" (plain JSON Schema).
    // Values are identical at runtime — SchemaType enum values are lowercase strings ("object", "string", etc.).
    const tools =
      opts.tools.length > 0
        ? opts.tools.map((tool) => ({
            functionDeclarations: (tool.functionDeclarations ?? []).map((decl) => ({
              name: decl.name,
              description: decl.description,
              parametersJsonSchema: decl.parameters as unknown as Record<string, unknown>,
            })),
          }))
        : undefined;

    const history = opts.history.map((msg) => ({
      role: msg.role === "model" ? ("model" as const) : ("user" as const),
      parts: [{ text: msg.content }],
    }));

    const chat = this.ai.chats.create({
      model: opts.modelName,
      config: {
        systemInstruction: opts.systemPrompt,
        tools,
      },
      history,
    });

    return new GeminiDeferredSession(chat);
  }
}
