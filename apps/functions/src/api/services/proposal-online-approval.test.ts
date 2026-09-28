import {
  OnlineApprovalSchema,
  acceptanceStatus,
  buildClientAcceptance,
  isProposalExpired,
  proposalContentHash,
  resolveAcceptanceOnSave,
  ChangeRequestSchema,
  pickPayableTransaction,
  resolveChangeRequestOnSave,
  pickApprovedStatus,
  publicChangeRequestHistory,
  todayInBrazil,
} from "./proposal-online-approval";

describe("OnlineApprovalSchema", () => {
  const valid = { name: "Maria Souza", document: "529.982.247-25", accepted: true };

  it("aceita nome, CPF válido e aceite", () => {
    expect(OnlineApprovalSchema.safeParse(valid).success).toBe(true);
  });

  it("aceita CNPJ", () => {
    expect(
      OnlineApprovalSchema.safeParse({ ...valid, document: "11.222.333/0001-81" }).success,
    ).toBe(true);
  });

  it("recusa documento inválido, nome curto, sem aceite e campo a mais", () => {
    expect(OnlineApprovalSchema.safeParse({ ...valid, document: "111.111.111-11" }).success).toBe(false);
    expect(OnlineApprovalSchema.safeParse({ ...valid, name: "Jo" }).success).toBe(false);
    expect(OnlineApprovalSchema.safeParse({ ...valid, accepted: false }).success).toBe(false);
    expect(OnlineApprovalSchema.safeParse({ ...valid, status: "approved" }).success).toBe(false);
  });
});

describe("buildClientAcceptance", () => {
  it("guarda documento só com dígitos, data, IP e navegador truncado", () => {
    const acceptance = buildClientAcceptance({
      input: { name: "  Maria  ", document: "529.982.247-25", accepted: true },
      ip: "200.1.2.3",
      userAgent: "x".repeat(500),
      sharedProposalId: "sp1",
      contentHash: "h1",
      now: new Date("2026-09-25T15:00:00.000Z"),
    });
    expect(acceptance).toMatchObject({
      name: "Maria",
      document: "52998224725",
      acceptedAt: "2026-09-25T15:00:00.000Z",
      ip: "200.1.2.3",
      sharedProposalId: "sp1",
      status: "pending",
      contentHash: "h1",
    });
    expect(acceptance.userAgent).toHaveLength(300);
  });
});

describe("proposalContentHash", () => {
  const base = {
    title: "Casa",
    totalValue: 1000,
    products: [{ productId: "a", quantity: 2 }],
    status: "sent",
    updatedAt: "2026-09-01",
  };

  it("não muda com status, datas de controle nem com o próprio aceite", () => {
    expect(
      proposalContentHash({
        ...base,
        status: "approved",
        updatedAt: "2026-09-26",
        clientAcceptance: { name: "x" },
        clientAcceptanceHistory: [{ name: "y" }],
      }),
    ).toBe(proposalContentHash(base));
  });

  it("vazio, nulo e ausente contam igual (o formulário reenvia tudo)", () => {
    expect(proposalContentHash({ ...base, customNotes: "", discount: null })).toBe(
      proposalContentHash(base),
    );
  });

  it("não depende da ordem das chaves", () => {
    expect(proposalContentHash({ totalValue: 1000, title: "Casa" })).toBe(
      proposalContentHash({ title: "Casa", totalValue: 1000 }),
    );
  });

  it("muda com valor, item ou texto", () => {
    const h = proposalContentHash(base);
    expect(proposalContentHash({ ...base, totalValue: 1200 })).not.toBe(h);
    expect(proposalContentHash({ ...base, products: [{ productId: "a", quantity: 3 }] })).not.toBe(h);
    expect(proposalContentHash({ ...base, title: "Casa nova" })).not.toBe(h);
  });
});

describe("resolveAcceptanceOnSave", () => {
  const proposal = { title: "Casa", totalValue: 1000 };
  const pending = { name: "Maria", status: "pending", contentHash: proposalContentHash(proposal) };

  it("aprovar sem mudar o conteúdo confirma o aceite", () => {
    expect(
      resolveAcceptanceOnSave({
        acceptance: pending,
        proposalAfter: { ...proposal, status: "approved" },
        isBeingApproved: true,
        closedWithoutApproval: false,
      }),
    ).toBe("confirmed");
  });

  it("editar o que o cliente viu anula, mesmo aprovando no mesmo salvamento", () => {
    for (const isBeingApproved of [true, false]) {
      expect(
        resolveAcceptanceOnSave({
          acceptance: pending,
          proposalAfter: { ...proposal, totalValue: 900 },
          isBeingApproved,
          closedWithoutApproval: false,
        }),
      ).toBe("invalidated");
    }
  });

  it("recusar ou voltar ao rascunho descarta", () => {
    expect(
      resolveAcceptanceOnSave({
        acceptance: pending,
        proposalAfter: proposal,
        isBeingApproved: false,
        closedWithoutApproval: true,
      }),
    ).toBe("discarded");
  });

  it("salvar sem mudar nada, ou mover para outra coluna aberta, mantém pendente", () => {
    expect(
      resolveAcceptanceOnSave({
        acceptance: pending,
        proposalAfter: { ...proposal, notes: "" },
        isBeingApproved: false,
        closedWithoutApproval: false,
      }),
    ).toBeNull();
  });

  it("aceite que não está pendente não muda", () => {
    for (const status of ["confirmed", "discarded", "invalidated"]) {
      expect(
        resolveAcceptanceOnSave({
          acceptance: { ...pending, status },
          proposalAfter: { ...proposal, totalValue: 1 },
          isBeingApproved: true,
          closedWithoutApproval: false,
        }),
      ).toBeNull();
    }
    expect(
      resolveAcceptanceOnSave({
        acceptance: undefined,
        proposalAfter: proposal,
        isBeingApproved: true,
        closedWithoutApproval: false,
      }),
    ).toBeNull();
  });

  it("aceite antigo sem status (de quando o link aprovava direto) conta como confirmado", () => {
    expect(acceptanceStatus({ name: "Maria" })).toBe("confirmed");
    expect(acceptanceStatus(undefined)).toBeNull();
  });
});

describe("isProposalExpired", () => {
  // 25/09/2026 às 01:00 UTC ainda é dia 24 em Brasília.
  const now = new Date("2026-09-25T01:00:00.000Z");

  it("usa o dia de Brasília", () => {
    expect(todayInBrazil(now)).toBe("2026-09-24");
  });

  it("o próprio dia da validade ainda vale", () => {
    expect(isProposalExpired("2026-09-24", now)).toBe(false);
    expect(isProposalExpired("2026-09-24T00:00:00.000Z", now)).toBe(false);
  });

  it("dia anterior está vencido", () => {
    expect(isProposalExpired("2026-09-23", now)).toBe(true);
  });

  it("sem validade não vence", () => {
    expect(isProposalExpired(undefined, now)).toBe(false);
    expect(isProposalExpired("", now)).toBe(false);
  });
});

describe("pickApprovedStatus", () => {
  it("sem colunas personalizadas usa 'approved'", () => {
    expect(pickApprovedStatus([])).toBe("approved");
  });

  it("prefere a coluna mapeada para aprovada, pela ordem", () => {
    expect(
      pickApprovedStatus([
        { id: "ganhou2", order: 5, mappedStatus: "approved" },
        { id: "ganhou1", order: 2, mappedStatus: "approved" },
        { id: "fechado", order: 1, category: "won" },
      ]),
    ).toBe("ganhou1");
  });

  it("sem mapeada, usa a primeira coluna ganha", () => {
    expect(
      pickApprovedStatus([
        { id: "aberta", order: 0, category: "open" },
        { id: "fechado", order: 3, category: "won" },
      ]),
    ).toBe("fechado");
  });
});

describe("ChangeRequestSchema", () => {
  it("exige uma justificativa de verdade", () => {
    expect(ChangeRequestSchema.safeParse({ message: "curto" }).success).toBe(false);
    expect(ChangeRequestSchema.safeParse({ message: "          " }).success).toBe(false);
    expect(
      ChangeRequestSchema.safeParse({ message: "O prazo de entrega combinado era 30 dias" }).success,
    ).toBe(true);
  });

  it("nome é opcional e campo a mais é recusado", () => {
    expect(ChangeRequestSchema.safeParse({ name: "Maria", message: "Faltou a cortina da sala" }).success).toBe(true);
    expect(ChangeRequestSchema.safeParse({ message: "Faltou a cortina da sala", status: "x" }).success).toBe(false);
  });
});

describe("resolveChangeRequestOnSave", () => {
  const proposal = { title: "Casa", totalValue: 1000 };
  const open = { status: "open", contentHash: proposalContentHash(proposal), message: "m" };

  it("editar o conteúdo atende o pedido", () => {
    expect(
      resolveChangeRequestOnSave({
        request: open,
        proposalAfter: { ...proposal, totalValue: 900 },
        isBeingApproved: false,
        closedWithoutApproval: false,
      }),
    ).toBe("resolved");
  });

  it("aprovar ou fechar sem aprovação encerra o pedido", () => {
    for (const [isBeingApproved, closedWithoutApproval] of [[true, false], [false, true]]) {
      expect(
        resolveChangeRequestOnSave({
          request: open,
          proposalAfter: proposal,
          isBeingApproved,
          closedWithoutApproval,
        }),
      ).toBe("resolved");
    }
  });

  it("salvar sem mudar nada deixa o pedido aberto", () => {
    expect(
      resolveChangeRequestOnSave({
        request: open,
        proposalAfter: { ...proposal, notes: "" },
        isBeingApproved: false,
        closedWithoutApproval: false,
      }),
    ).toBeNull();
  });

  it("pedido já resolvido ou ausente não muda", () => {
    expect(
      resolveChangeRequestOnSave({
        request: { ...open, status: "resolved" },
        proposalAfter: { ...proposal, totalValue: 1 },
        isBeingApproved: true,
        closedWithoutApproval: false,
      }),
    ).toBeNull();
    expect(
      resolveChangeRequestOnSave({
        request: undefined,
        proposalAfter: proposal,
        isBeingApproved: true,
        closedWithoutApproval: false,
      }),
    ).toBeNull();
  });
});

describe("pickPayableTransaction", () => {
  it("a entrada em aberto vem primeiro", () => {
    expect(
      pickPayableTransaction([
        { id: "parcela", type: "income", status: "pending", dueDate: "2026-10-01" },
        { id: "entrada", type: "income", status: "pending", isDownPayment: true },
      ]),
    ).toEqual({ id: "entrada", isDownPayment: true });
  });

  it("entrada paga: a próxima parcela a vencer", () => {
    expect(
      pickPayableTransaction([
        { id: "entrada", type: "income", status: "paid", isDownPayment: true },
        { id: "p3", type: "income", status: "pending", dueDate: "2026-12-01" },
        { id: "p2", type: "income", status: "overdue", dueDate: "2026-11-01" },
      ]),
    ).toEqual({ id: "p2", isDownPayment: false });
  });

  it("comissão, despesa e tudo pago: nada a pagar", () => {
    expect(
      pickPayableTransaction([
        { id: "c", type: "expense", isCommission: true, status: "pending" },
        { id: "x", type: "expense", status: "pending" },
        { id: "p", type: "income", status: "paid" },
      ]),
    ).toBeNull();
  });
});


describe("publicChangeRequestHistory", () => {
  const resolved = (requestedAt: string, over: Record<string, unknown> = {}) => ({
    name: "Maria",
    message: `Pedido de ${requestedAt}`,
    requestedAt,
    ip: "200.1.2.3",
    userAgent: "Mozilla",
    sharedProposalId: "sp1",
    status: "resolved",
    contentHash: "h",
    resolvedAt: "2026-09-27T12:00:00.000Z",
    resolvedBy: "uid-da-equipe",
    ...over,
  });

  it("junta o atual e o histórico, do mais novo ao mais antigo, sem IP nem quem resolveu", () => {
    const current = resolved("2026-09-26T10:00:00.000Z", { status: "open", resolvedAt: undefined, resolvedBy: undefined });
    const list = publicChangeRequestHistory(current, [
      resolved("2026-09-20T10:00:00.000Z"),
      resolved("2026-09-24T10:00:00.000Z", { name: null }),
    ]);
    expect(list.map((r) => [r.requestedAt, r.status])).toEqual([
      ["2026-09-26T10:00:00.000Z", "open"],
      ["2026-09-24T10:00:00.000Z", "resolved"],
      ["2026-09-20T10:00:00.000Z", "resolved"],
    ]);
    expect(list[0]).toEqual({
      name: "Maria",
      message: "Pedido de 2026-09-26T10:00:00.000Z",
      requestedAt: "2026-09-26T10:00:00.000Z",
      status: "open",
      resolvedAt: null,
    });
    expect(list[1].name).toBeNull();
    for (const item of list) {
      expect(Object.keys(item).sort()).toEqual(["message", "name", "requestedAt", "resolvedAt", "status"]);
    }
  });

  it("o atual resolvido aparece como resolvido, com a data", () => {
    const list = publicChangeRequestHistory(resolved("2026-09-26T10:00:00.000Z"), undefined);
    expect(list).toEqual([
      expect.objectContaining({ status: "resolved", resolvedAt: "2026-09-27T12:00:00.000Z" }),
    ]);
  });

  it("pedido no histórico nunca aparece aberto, nem sem status", () => {
    const list = publicChangeRequestHistory(undefined, [
      resolved("2026-09-20T10:00:00.000Z", { status: "open" }),
      resolved("2026-09-21T10:00:00.000Z", { status: undefined }),
    ]);
    expect(list.every((r) => r.status === "resolved")).toBe(true);
  });

  it("sem pedido nenhum: lista vazia; lixo e repetido ficam de fora", () => {
    expect(publicChangeRequestHistory(undefined, undefined)).toEqual([]);
    const current = resolved("2026-09-26T10:00:00.000Z");
    const list = publicChangeRequestHistory(current, [current, null, "x", { message: 1 }]);
    expect(list).toHaveLength(1);
  });
});
