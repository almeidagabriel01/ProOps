import {
  GoogleGenerativeAI,
  type FunctionDeclarationsTool,
  type FunctionResponsePart,
  type ChatSession,
  type GenerateContentStreamResult,
} from "@google/generative-ai";
import type { AiConversationMessage } from "../ai.types";
import type { AiChatSession, AiProvider, ProviderEvent, ToolFeedback } from "./provider.interface";

/**
 * Gemini chat session. Defers the first sendMessageStream until the caller
 * provides the user message via streamTurn(), keeping a uniform interface
 * with subsequent tool-result turns.
 */
class GeminiDeferredSession implements AiChatSession {
  private chat: ChatSession;
  private started: boolean = false;

  constructor(chat: ChatSession) {
    this.chat = chat;
  }

  async *streamTurn(input: string | ToolFeedback[]): AsyncGenerator<ProviderEvent> {
    let streamResult: GenerateContentStreamResult;

    if (!this.started) {
      this.started = true;
      const userMessage = typeof input === "string" ? input : "";
      streamResult = await this.chat.sendMessageStream(userMessage);
    } else if (Array.isArray(input)) {
      // Tool-result turn: convert ToolFeedback[] → FunctionResponsePart[]
      const parts: FunctionResponsePart[] = (input as ToolFeedback[]).map((fb) => ({
        functionResponse: {
          name: fb.name,
          response: fb.response,
        },
      }));
      streamResult = await this.chat.sendMessageStream(parts);
    } else {
      streamResult = await this.chat.sendMessageStream(input as string);
    }

    const pendingToolCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

    for await (const chunk of streamResult.stream) {
      const text = chunk.text();
      if (text) {
        yield { type: "text", content: text };
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

    if (pendingToolCalls.length > 0) {
      yield { type: "tool_calls", calls: pendingToolCalls };
    }

    const response = await streamResult.response;
    const totalTokens = response.usageMetadata?.totalTokenCount ?? 0;
    yield { type: "done", totalTokens };
  }
}

export class GeminiProvider implements AiProvider {
  private genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  createSession(opts: {
    systemPrompt: string;
    history: AiConversationMessage[];
    tools: FunctionDeclarationsTool[];
    modelName: string;
  }): AiChatSession {
    const model = this.genAI.getGenerativeModel({
      model: opts.modelName,
      systemInstruction: opts.systemPrompt,
      tools: opts.tools.length > 0 ? opts.tools : undefined,
    });

    const geminiHistory = opts.history.map((msg) => ({
      role: msg.role === "model" ? ("model" as const) : ("user" as const),
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({ history: geminiHistory });
    return new GeminiDeferredSession(chat);
  }
}
