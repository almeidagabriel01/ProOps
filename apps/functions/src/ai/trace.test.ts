const addMock = jest.fn().mockResolvedValue({ id: "trace-1" });
const collectionMock = jest.fn(() => ({ add: addMock }));

jest.mock("../init", () => ({
  db: { collection: (...args: unknown[]) => collectionMock(...(args as [])) },
}));

jest.mock("../lib/logger", () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

import { startAiTrace, AI_TRACES_COLLECTION } from "./trace";

const baseInput = {
  tenantId: "t1",
  uid: "u1",
  sessionId: "s1",
  planTier: "pro",
  promptChars: 42,
};

const baseFinish = {
  status: "ok" as const,
  provider: "gemini",
  modelName: "gemini-2.5-flash",
  totalTokens: 1234,
  responseChars: 900,
};

/** Documento passado ao Firestore na chamada `n` de `add`. */
function written(call = 0): Record<string, unknown> {
  return addMock.mock.calls[call][0] as Record<string, unknown>;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("startAiTrace", () => {
  it("grava um doc por turno com desfecho, tokens e ferramentas", async () => {
    const trace = startAiTrace(baseInput);
    trace.recordTool("list_transactions", true, 120);
    trace.recordTool("create_contact", false, 40);
    await trace.finish(baseFinish);

    expect(collectionMock).toHaveBeenCalledWith(AI_TRACES_COLLECTION);
    expect(addMock).toHaveBeenCalledTimes(1);

    const doc = written();
    expect(doc).toMatchObject({
      tenantId: "t1",
      uid: "u1",
      sessionId: "s1",
      planTier: "pro",
      provider: "gemini",
      status: "ok",
      totalTokens: 1234,
      promptChars: 42,
      responseChars: 900,
      toolCount: 2,
      toolsFailed: 1,
    });
    expect(doc.tools).toEqual([
      { name: "list_transactions", ok: true, ms: 120 },
      { name: "create_contact", ok: false, ms: 40 },
    ]);
  });

  it("NUNCA persiste argumentos de ferramenta nem conteúdo de mensagem", async () => {
    const trace = startAiTrace(baseInput);
    trace.recordTool("create_transaction", true, 10);
    await trace.finish(baseFinish);

    // O rastro inteiro serializado não pode conter nada além de metadados.
    // Args carregam nome de cliente, valor e CPF — se algum dia forem
    // adicionados ao doc, este teste falha antes de chegar em produção.
    const serialized = JSON.stringify(written());
    for (const field of ["args", "message", "content", "response", "prompt"]) {
      expect(serialized).not.toContain(`"${field}"`);
    }

    const tools = written().tools as Array<Record<string, unknown>>;
    expect(Object.keys(tools[0]).sort()).toEqual(["ms", "name", "ok"]);
  });

  it("finish é idempotente — o finally pode rodar depois do caminho de erro", async () => {
    const trace = startAiTrace(baseInput);
    await trace.finish(baseFinish);
    await trace.finish({ ...baseFinish, status: "error", errorCode: "rate_limited" });

    expect(addMock).toHaveBeenCalledTimes(1);
    expect(written().status).toBe("ok");
  });

  it("não grava nada quando finish não é chamado", () => {
    const trace = startAiTrace(baseInput);
    trace.recordTool("get_contact", true, 5);

    expect(addMock).not.toHaveBeenCalled();
  });

  it("falha de escrita não propaga — observabilidade não derruba o stream", async () => {
    addMock.mockRejectedValueOnce(new Error("firestore indisponível"));

    const trace = startAiTrace(baseInput);
    await expect(trace.finish(baseFinish)).resolves.toBeUndefined();
  });

  /**
   * REGRESSÃO (2026-08-27): a primeira versão disparava o write sem await.
   * No Cloud Run a CPU só é alocada durante a request — com o write pendente
   * no retorno do handler, a instância congela e a escrita se perde EM
   * SILÊNCIO (nem o .catch() roda). Sintoma real em dev: a Lia respondeu e
   * nenhum trace apareceu, sem erro nenhum no log.
   *
   * O contrato que este teste protege: `finish` só resolve DEPOIS que o write
   * termina, para o chamador poder aguardar dentro do ciclo da request.
   */
  it("finish só resolve depois que a escrita termina (não é fire-and-forget)", async () => {
    let resolveWrite: (v: unknown) => void = () => undefined;
    addMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveWrite = resolve;
      }),
    );

    const trace = startAiTrace(baseInput);
    let resolved = false;
    const pending = trace.finish(baseFinish).then(() => {
      resolved = true;
    });

    // Escrita ainda em voo: finish NÃO pode ter resolvido.
    await Promise.resolve();
    expect(resolved).toBe(false);

    resolveWrite({ id: "trace-1" });
    await pending;
    expect(resolved).toBe(true);
  });

  it("limita o número de ferramentas registradas por turno", async () => {
    const trace = startAiTrace(baseInput);
    for (let i = 0; i < 200; i += 1) trace.recordTool(`tool_${i}`, true, 1);
    await trace.finish(baseFinish);

    expect((written().tools as unknown[]).length).toBe(50);
    expect(written().toolCount).toBe(50);
  });
});
