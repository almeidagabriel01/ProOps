import Groq from "groq-sdk";
import type { FunctionDeclarationsTool } from "@google/generative-ai";
import type { AiConversationMessage } from "../ai.types";
import type { AiChatSession, AiProvider, ProviderEvent, ToolFeedback } from "./provider.interface";

/**
 * Recursively normalize Gemini SDK SchemaType enum values to lowercase JSON Schema type names.
 * Gemini uses uppercase ("OBJECT", "ARRAY", "STRING"); Groq/OpenAI require lowercase.
 */
function normalizeSchemaTypes(schema: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "type" && typeof value === "string") {
      result[key] = value.toLowerCase();
    } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result[key] = normalizeSchemaTypes(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item !== null && typeof item === "object" && !Array.isArray(item)
          ? normalizeSchemaTypes(item as Record<string, unknown>)
          : item,
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Convert Gemini FunctionDeclarationsTool[] to Groq/OpenAI ChatCompletionTool[] format.
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
          parameters: normalizeSchemaTypes(
            (fn.parameters ?? { type: "object", properties: {} }) as Record<string, unknown>,
          ),
        },
      });
    }
  }
  return result;
}

type GroqMessage = Groq.Chat.Completions.ChatCompletionMessageParam;

class GroqChatSession implements AiChatSession {
  private client: Groq;
  private groqTools: Groq.Chat.Completions.ChatCompletionTool[];
  private messages: GroqMessage[];

  constructor(
    client: Groq,
    groqTools: Groq.Chat.Completions.ChatCompletionTool[],
    systemPrompt: string,
    history: AiConversationMessage[],
  ) {
    this.client = client;
    this.groqTools = groqTools;
    this.messages = [
      { role: "system", content: systemPrompt },
      ...history.map((msg) => ({
        role: msg.role === "model" ? ("assistant" as const) : ("user" as const),
        content: msg.content,
      })),
    ];
  }

  async *streamTurn(input: string | ToolFeedback[]): AsyncGenerator<ProviderEvent> {
    if (typeof input === "string") {
      this.messages.push({ role: "user", content: input });
    } else {
      // Tool results turn — these were already pushed as assistant + tool messages
      // by the previous iteration; nothing to add here (handled after tool execution)
      // Actually tool feedbacks need to be added now:
      for (const fb of input) {
        // Find the matching tool call id from the last assistant message
        const lastAssistant = [...this.messages].reverse().find((m) => m.role === "assistant") as
          | Groq.Chat.Completions.ChatCompletionAssistantMessageParam
          | undefined;
        const toolCall = lastAssistant?.tool_calls?.find((tc) => tc.function.name === fb.name);
        this.messages.push({
          role: "tool",
          tool_call_id: toolCall?.id ?? fb.name,
          content: JSON.stringify(fb.response),
        });
      }
    }

    interface ToolCallAcc {
      id: string;
      name: string;
      arguments: string;
    }
    const pendingToolCalls: ToolCallAcc[] = [];
    let assistantContent = "";

    const stream = await this.client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: this.messages,
      tools: this.groqTools.length > 0 ? this.groqTools : undefined,
      tool_choice: this.groqTools.length > 0 ? "auto" : undefined,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        assistantContent += delta.content;
        yield { type: "text", content: delta.content };
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

    if (completedToolCalls.length > 0) {
      // Push assistant turn with tool calls to internal message history
      this.messages.push({
        role: "assistant",
        content: assistantContent || null,
        tool_calls: completedToolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      });

      yield {
        type: "tool_calls",
        calls: completedToolCalls.map((tc) => {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.arguments) as Record<string, unknown>;
          } catch {
            // Malformed JSON args — proceed with empty args
          }
          return { name: tc.name, args };
        }),
      };
    }

    // Groq does not report token usage in stream chunks by default
    yield { type: "done", totalTokens: 0 };
  }
}

export class GroqProvider implements AiProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  createSession(opts: {
    systemPrompt: string;
    history: AiConversationMessage[];
    tools: FunctionDeclarationsTool[];
    modelName: string;
  }): AiChatSession {
    const client = new Groq({ apiKey: this.apiKey });
    const groqTools = geminiToolsToGroqFormat(opts.tools);
    return new GroqChatSession(client, groqTools, opts.systemPrompt, opts.history);
  }
}
