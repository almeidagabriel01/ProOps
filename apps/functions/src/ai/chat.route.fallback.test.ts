/**
 * O fallback do Groq (emulador, Gemini sem cota) rodava uma COPIA do laço de
 * ferramentas, e a copia divergiu: nao repassava o `confirmationToken` ao front
 * (a confirmacao de exclusao/lancamento nunca podia ser concluida) e nao tinha
 * o teto de chamadas por rodada. Os dois caminhos agora usam `runToolLoop`.
 */

const executeToolCall = jest.fn();
const createAiProvider = jest.fn();
const createGroqFallbackProvider = jest.fn();

jest.mock("../init", () => ({
  db: {
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: true, data: () => ({ name: "ACME", niche: "automacao_residencial" }) }),
      }),
    }),
  },
}));
jest.mock("../lib/tenant-plan-policy", () => ({
  getTenantPlanProfile: async () => ({ tier: "enterprise", subscriptionStatus: "active", source: "test" }),
  evaluateSubscriptionStatusAccess: () => ({ allowWrite: true }),
}));
jest.mock("../lib/tenant-capabilities", () => ({
  resolveTenantCapabilities: async () => ({ capabilities: {} }),
}));
jest.mock("../lib/whatsapp-eligibility", () => ({ tenantPlanAllowsWhatsApp: async () => false }));
jest.mock("../lib/auth-helpers", () => ({ loadPagePermissions: async () => ({}) }));
jest.mock("./usage-tracker", () => ({
  checkAiLimit: async () => ({ allowed: true, messagesUsed: 0, messagesLimit: 100, resetAt: "" }),
  reserveAiMessage: async () => undefined,
  finalizeTokenUsage: async () => undefined,
  refundAiMessage: async () => undefined,
  getAiUsage: async () => null,
}));
jest.mock("./conversation-store", () => ({
  loadConversation: async () => [],
  saveConversation: async () => undefined,
}));
jest.mock("./tools/index", () => ({ buildAvailableTools: () => [] }));
jest.mock("./tools/executor", () => ({
  executeToolCall: (...args: unknown[]) => executeToolCall(...args),
}));
jest.mock("./trace", () => ({
  startAiTrace: () => ({ recordTool: jest.fn(), finish: async () => undefined }),
}));
jest.mock("./provider-error-alert", () => ({ alertProviderConfigError: async () => undefined }));
jest.mock("./provider-error", () => ({
  classifyProviderError: () => ({
    category: "rate_limited",
    clientMessage: "Limite",
    operatorActionable: false,
  }),
}));
jest.mock("./providers/index", () => ({
  createAiProvider: (...args: unknown[]) => createAiProvider(...args),
  createGroqFallbackProvider: (...args: unknown[]) => createGroqFallbackProvider(...args),
}));

import type { Request, Response } from "express";
import { aiRouter } from "./chat.route";

type Call = { name: string; args: Record<string, unknown> };

function sessionFrom(turns: Call[][]) {
  let turn = 0;
  return {
    async *streamTurn() {
      const calls = turns[turn++] ?? [];
      if (calls.length > 0) yield { type: "tool_calls" as const, calls };
      yield { type: "done" as const, totalTokens: 1 };
    },
  };
}

function geminiOutOfQuota() {
  createAiProvider.mockReturnValue({
    createSession: () => ({
      async *streamTurn() {
        throw new Error("429 Too Many Requests");
      },
    }),
  });
}

function chatHandler() {
  const layer = (aiRouter.stack as Array<{ route?: { path: string; stack: Array<{ handle: unknown }> } }>)
    .find((l) => l.route?.path === "/chat");
  return layer!.route!.stack[0].handle as (req: Request, res: Response) => Promise<void>;
}

async function postChat(): Promise<Array<Record<string, unknown>>> {
  const written: string[] = [];
  const res = {
    headersSent: false,
    writableEnded: false,
    setTimeout: () => res,
    setHeader: () => res,
    flushHeaders() {
      res.headersSent = true;
    },
    write(chunk: string) {
      written.push(chunk);
      return true;
    },
    end() {
      res.writableEnded = true;
    },
    status: () => res,
    json: () => res,
  };
  const req = {
    user: { uid: "u1", tenantId: "t1", role: "ADMIN", email: "a@b.c" },
    body: { message: "apague o contato Joao", sessionId: "s1" },
  };
  await chatHandler()(req as unknown as Request, res as unknown as Response);
  return written
    .filter((c) => c.startsWith("data: {"))
    .map((c) => JSON.parse(c.slice("data: ".length)) as Record<string, unknown>);
}

describe("POST /chat — fallback do Groq usa o mesmo laço de ferramentas", () => {
  const env = { ...process.env };

  beforeEach(() => {
    executeToolCall.mockReset();
    createAiProvider.mockReset();
    createGroqFallbackProvider.mockReset();
    process.env.FUNCTIONS_EMULATOR = "true";
    process.env.GEMINI_API_KEY = "gemini-test";
    process.env.GROQ_API_KEY = "groq-test";
    delete process.env.AI_PROVIDER;
    geminiOutOfQuota();
  });

  afterAll(() => {
    process.env = env;
  });

  it("repassa o confirmationToken ao front quando o Groq pede confirmação", async () => {
    createGroqFallbackProvider.mockReturnValue({
      createSession: () =>
        sessionFrom([[{ name: "request_confirmation", args: { action: "Apagar Joao" } }]]),
    });
    executeToolCall.mockResolvedValue({
      success: true,
      requiresConfirmation: true,
      confirmationToken: "tok-123",
      confirmationData: { action: "Apagar Joao", affectedRecords: ["Joao"], severity: "high" },
    });

    const chunks = await postChat();

    const toolResult = chunks.find((c) => c.type === "tool_result") as
      | { toolResult: { confirmationToken?: string; requiresConfirmation?: boolean } }
      | undefined;
    expect(toolResult?.toolResult.requiresConfirmation).toBe(true);
    expect(toolResult?.toolResult.confirmationToken).toBe("tok-123");
  });

  it("limita as chamadas de ferramenta por rodada também no fallback", async () => {
    const twelve = Array.from({ length: 12 }, (_, i) => ({
      name: "list_contacts",
      args: { search: `c${i}` },
    }));
    createGroqFallbackProvider.mockReturnValue({ createSession: () => sessionFrom([twelve]) });
    executeToolCall.mockResolvedValue({ success: true, data: [] });

    await postChat();

    expect(executeToolCall).toHaveBeenCalledTimes(10);
  });

  it("o provedor principal também repassa o token (os dois caminhos são o mesmo laço)", async () => {
    createAiProvider.mockReturnValue({
      createSession: () =>
        sessionFrom([[{ name: "request_confirmation", args: { action: "Apagar Joao" } }]]),
    });
    executeToolCall.mockResolvedValue({
      success: true,
      requiresConfirmation: true,
      confirmationToken: "tok-main",
    });

    const chunks = await postChat();

    expect(createGroqFallbackProvider).not.toHaveBeenCalled();
    const toolResult = chunks.find((c) => c.type === "tool_result") as
      | { toolResult: { confirmationToken?: string } }
      | undefined;
    expect(toolResult?.toolResult.confirmationToken).toBe("tok-main");
  });
});
