import type { FunctionDeclarationsTool } from "@google/generative-ai";
import type { AiConversationMessage } from "../ai.types";
import type { AiChatSession, AiProvider, ProviderEvent, ToolFeedback } from "./provider.interface";

/**
 * Deterministic mock provider for E2E tests.
 * Does NOT make any network calls.
 * Behavior is driven by keywords in the user message.
 */
class MockChatSession implements AiChatSession {
  private userMessage: string = "";
  private awaitingToolResult: string = "";

  async *streamTurn(input: string | ToolFeedback[]): AsyncGenerator<ProviderEvent> {
    if (typeof input === "string") {
      this.userMessage = input.toLowerCase();
      this.awaitingToolResult = "";

      if (this.userMessage.includes("list") || this.userMessage.includes("listar")) {
        this.awaitingToolResult = "list";
        yield { type: "tool_calls", calls: [{ name: "list_contacts", args: {} }] };
        yield { type: "done", totalTokens: 10 };
      } else if (this.userMessage.includes("cria") || this.userMessage.includes("create")) {
        this.awaitingToolResult = "create";
        yield {
          type: "tool_calls",
          calls: [{ name: "create_contact", args: { name: "Mock Contact", phone: "11999999999" } }],
        };
        yield { type: "done", totalTokens: 10 };
      } else if (this.userMessage.includes("delete") || this.userMessage.includes("exclu")) {
        yield {
          type: "tool_calls",
          calls: [
            {
              name: "request_confirmation",
              args: {
                action: "delete_contact",
                affectedRecords: ["Mock Contact"],
                severity: "high",
              },
            },
          ],
        };
        yield { type: "done", totalTokens: 10 };
      } else {
        yield {
          type: "text",
          content: "Olá! Sou a Lia (mock). Posso ajudar com contatos, propostas e produtos.",
        };
        yield { type: "done", totalTokens: 5 };
      }
    } else {
      // Tool result turn
      if (this.awaitingToolResult === "list") {
        const toolResults = input as ToolFeedback[];
        const data = toolResults[0]?.response as Record<string, unknown> | undefined;
        const count =
          Array.isArray((data as Record<string, unknown> | undefined)?.contacts)
            ? ((data as Record<string, unknown>).contacts as unknown[]).length
            : 0;
        yield { type: "text", content: `Encontrei ${count} contatos no sistema.` };
        yield { type: "done", totalTokens: 10 };
      } else if (this.awaitingToolResult === "create") {
        yield { type: "text", content: "Contato criado com sucesso!" };
        yield { type: "done", totalTokens: 10 };
      } else {
        yield { type: "text", content: "Operação concluída." };
        yield { type: "done", totalTokens: 5 };
      }
      this.awaitingToolResult = "";
    }
  }
}

export class MockProvider implements AiProvider {
  createSession(_opts: {
    systemPrompt: string;
    history: AiConversationMessage[];
    tools: FunctionDeclarationsTool[];
    modelName: string;
  }): AiChatSession {
    return new MockChatSession();
  }
}
