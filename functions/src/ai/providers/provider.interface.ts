import type { FunctionDeclarationsTool } from "@google/generative-ai";
import type { AiConversationMessage } from "../ai.types";

export type ProviderEvent =
  | { type: "text"; content: string }
  | { type: "thinking" }
  | { type: "tool_calls"; calls: Array<{ name: string; args: Record<string, unknown> }> }
  | { type: "done"; totalTokens: number };

export type ToolFeedback = { name: string; response: object };

export interface AiChatSession {
  /**
   * Stream a turn. Input is either a user message string or tool results from previous turn.
   * Yields text chunks, then either tool_calls (more rounds needed) or done.
   */
  streamTurn(input: string | ToolFeedback[]): AsyncGenerator<ProviderEvent>;
}

export interface AiProvider {
  createSession(opts: {
    systemPrompt: string;
    history: AiConversationMessage[];
    tools: FunctionDeclarationsTool[];
    modelName: string;
  }): AiChatSession;
}
