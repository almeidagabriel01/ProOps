import {
  OnlineApprovalSchema,
  buildClientAcceptance,
  isProposalExpired,
  pickApprovedStatus,
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
      now: new Date("2026-09-25T15:00:00.000Z"),
    });
    expect(acceptance).toMatchObject({
      name: "Maria",
      document: "52998224725",
      acceptedAt: "2026-09-25T15:00:00.000Z",
      ip: "200.1.2.3",
      sharedProposalId: "sp1",
    });
    expect(acceptance.userAgent).toHaveLength(300);
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
