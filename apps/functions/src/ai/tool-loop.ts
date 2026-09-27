import { logger } from "../lib/logger";
import type { AiChatChunk } from "./ai.types";
import type { AiChatSession, ToolFeedback } from "./providers/provider.interface";
import type { executeToolCall } from "./tools/executor";

export const MAX_TOOL_ROUNDS = 5;
export const MAX_TOOL_CALLS_PER_ROUND = 10;

type ToolResult = Awaited<ReturnType<typeof executeToolCall>>;

export interface ToolLoopOptions {
  session: AiChatSession;
  message: string;
  tenantId: string;
  runTool: (name: string, args: Record<string, unknown>) => Promise<ToolResult>;
  write: (chunk: AiChatChunk) => void;
  onText: (content: string) => void;
  onTotalTokens: (totalTokens: number) => void;
}

/**
 * Laço de chamada de ferramentas de um turno da Lia, o mesmo para o provedor
 * principal e para o fallback do Groq. Existia duplicado na rota, e a cópia do
 * fallback perdeu o `confirmationToken` e o teto de chamadas por rodada.
 *
 * Devolve `confirmationPending: true` quando uma ferramenta pediu confirmação:
 * o turno para ali e a mensagem não é cobrada.
 */
export async function runToolLoop(
  opts: ToolLoopOptions,
): Promise<{ confirmationPending: boolean }> {
  const { session, runTool, write } = opts;
  let toolRound = 0;
  let currentInput: string | ToolFeedback[] = opts.message;

  while (toolRound < MAX_TOOL_ROUNDS) {
    let pendingToolCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

    for await (const event of session.streamTurn(currentInput)) {
      if (event.type === "text") {
        opts.onText(event.content);
        write({ type: "text", content: event.content });
      } else if (event.type === "thinking") {
        write({ type: "thinking" });
      } else if (event.type === "tool_calls") {
        pendingToolCalls = event.calls;
      } else if (event.type === "done") {
        opts.onTotalTokens(event.totalTokens);
      }
    }

    if (pendingToolCalls.length > MAX_TOOL_CALLS_PER_ROUND) {
      logger.warn(`AI tool calls per round capped (${pendingToolCalls.length} → ${MAX_TOOL_CALLS_PER_ROUND})`, {
        tenantId: opts.tenantId,
      });
      pendingToolCalls = pendingToolCalls.slice(0, MAX_TOOL_CALLS_PER_ROUND);
    }

    if (pendingToolCalls.length === 0) break;

    const toolFeedbacks: ToolFeedback[] = [];

    for (const tc of pendingToolCalls) {
      write({ type: "tool_call", toolCall: { name: tc.name, args: tc.args } });

      const result = await runTool(tc.name, tc.args);

      write({
        type: "tool_result",
        toolResult: {
          name: tc.name,
          result: result.data,
          requiresConfirmation: result.requiresConfirmation,
          confirmationToken: result.confirmationToken,
          confirmationData: result.confirmationData,
        },
      });

      if (result.requiresConfirmation) return { confirmationPending: true };

      const rawData = result.success
        ? (result.data ?? { status: "ok" })
        : { error: result.error ?? "unknown error" };
      // Gemini's function_response.response uses google.protobuf.Struct which only accepts JSON objects, not arrays
      const responseObj: object = Array.isArray(rawData) ? { items: rawData } : (rawData as object);

      toolFeedbacks.push({ name: tc.name, response: responseObj });
    }

    currentInput = toolFeedbacks;
    toolRound++;
  }

  return { confirmationPending: false };
}
