import {
  buildPortalInvoices,
  buildPortalPayments,
  buildPortalProjects,
  buildPortalProposals,
  classifyProposalStatus,
  firstName,
  proposalsNeedingShareCheck,
} from "./client-portal-model";

describe("onde a proposta está no caminho até o cliente", () => {
  it.each([
    ["approved", undefined, "approved"],
    ["default_2", undefined, "approved"],
    ["rejected", undefined, "rejected"],
    ["default_3", undefined, "rejected"],
    ["sent", undefined, "sent"],
    ["default_1", undefined, "sent"],
    ["in_progress", undefined, "building"],
    ["default_0", undefined, "building"],
    ["draft", undefined, "draft"],
    ["", undefined, "draft"],
    ["col1", { mappedStatus: "approved" }, "approved"],
    ["col1", { mappedStatus: "sent" }, "sent"],
    ["col1", { mappedStatus: "in_progress" }, "building"],
    ["col1", { category: "lost" }, "rejected"],
    ["col1", { label: "Ganhas" }, "approved"],
    ["col1", { label: "Enviadas" }, "sent"],
    ["col1", { label: "Rascunho" }, "draft"],
    ["col1", { category: "open", label: "Em aberto" }, "building"],
    ["col1", { category: "open", label: "Negociação" }, "unknown"],
    ["col_sem_doc", undefined, "unknown"],
  ] as const)("%s (%j) é %s", (status, kanban, expected) => {
    expect(classifyProposalStatus(status, kanban)).toBe(expected);
  });
});

describe("propostas", () => {
  const docs = [
    { id: "rascunho", data: { status: "draft", title: "Rascunho", createdAt: "2026-09-20" } },
    { id: "aberto", data: { status: "in_progress", title: "Montando", createdAt: "2026-09-21" } },
    { id: "enviada", data: { status: "sent", title: "Casa", totalValue: 1000, createdAt: "2026-09-10" } },
    { id: "aprovada", data: { status: "approved", title: "Loja", totalValue: 5000, closedValue: 4500, createdAt: "2026-09-15" } },
    { id: "coluna", data: { status: "neg", title: "Negociando", totalValue: 700, createdAt: "2026-09-12" } },
  ];
  const kanban = new Map([["neg", { category: "open", label: "Negociação" }]]);

  it("só o que já foi para o cliente: rascunho, em aberto e coluna própria sem link ficam de fora", () => {
    const list = buildPortalProposals(docs, kanban);
    expect(list.map((p) => [p.id, p.state, p.value])).toEqual([
      ["aprovada", "approved", 4500],
      ["enviada", "open", 1000],
    ]);
  });

  it("coluna própria entra quando a empresa já gerou o link; em aberto e rascunho continuam fora", () => {
    const list = buildPortalProposals(docs, kanban, new Set(["coluna", "aberto", "rascunho"]));
    expect(list.map((p) => p.id)).toEqual(["aprovada", "coluna", "enviada"]);
  });

  it("só as de coluna indefinida precisam da consulta do link", () => {
    expect(proposalsNeedingShareCheck(docs, kanban)).toEqual(["coluna"]);
  });
});

describe("pagamentos", () => {
  const today = "2026-09-26";

  it("só receita e nunca a comissão (que é do parceiro, não do cliente)", () => {
    const list = buildPortalPayments(
      [
        { id: "r", data: { type: "income", status: "pending", amount: 100, dueDate: "2026-10-01" } },
        { id: "d", data: { type: "expense", status: "pending", amount: 50, dueDate: "2026-10-01" } },
        { id: "c", data: { type: "income", isCommission: true, status: "pending", amount: 10, dueDate: "2026-10-01" } },
      ],
      today,
    );
    expect(list.map((p) => p.id)).toEqual(["r"]);
  });

  it("vencido pela data mesmo antes do cron; entrada primeiro; pagos no fim", () => {
    const list = buildPortalPayments(
      [
        { id: "pago", data: { type: "income", status: "paid", amount: 1, dueDate: "2026-08-01" } },
        { id: "p2", data: { type: "income", status: "pending", amount: 1, dueDate: "2026-11-01" } },
        { id: "vencida", data: { type: "income", status: "pending", amount: 1, dueDate: "2026-09-20" } },
        { id: "entrada", data: { type: "income", status: "pending", amount: 1, dueDate: "2026-12-01", isDownPayment: true } },
      ],
      today,
    );
    expect(list.map((p) => [p.id, p.status])).toEqual([
      ["entrada", "pending"],
      ["vencida", "overdue"],
      ["p2", "pending"],
      ["pago", "paid"],
    ]);
  });
});

describe("obra e notas", () => {
  it("obra cancelada some; avanço pelas etapas concluídas", () => {
    const list = buildPortalProjects([
      { id: "x", data: { status: "canceled", stages: [] } },
      {
        id: "y",
        data: {
          title: "Casa",
          status: "active",
          stages: [{ status: "done" }, { status: "in_progress" }, { status: "pending" }],
          delivery: { status: "sent" },
        },
      },
    ]);
    expect(list).toEqual([
      { id: "y", title: "Casa", status: "active", stagesDone: 1, stagesTotal: 3, deliveryAccepted: false, nextVisit: null },
    ]);
  });

  it("mostra a próxima visita marcada, sem o id do evento da Agenda", () => {
    const now = Date.parse("2026-10-15T12:00:00.000Z");
    const at = (iso: string) => ({
      eventId: "ev-interno",
      isAllDay: false,
      startsAt: iso,
      endsAt: new Date(Date.parse(iso) + 3 * 3600_000).toISOString(),
      startDate: null,
      endDate: null,
      startMs: Date.parse(iso),
      endMs: Date.parse(iso) + 3 * 3600_000,
    });
    const [project] = buildPortalProjects(
      [
        {
          id: "y",
          data: {
            title: "Casa",
            status: "active",
            stages: [
              { name: "Medição", status: "done", schedule: at("2026-10-16T11:00:00.000Z") },
              { name: "Instalação", status: "pending", schedule: at("2026-10-20T11:00:00.000Z") },
            ],
          },
        },
      ],
      now,
    );
    expect(project.nextVisit).toEqual({
      stageName: "Instalação",
      isAllDay: false,
      startsAt: "2026-10-20T11:00:00.000Z",
      endsAt: "2026-10-20T14:00:00.000Z",
      startDate: null,
      endDate: null,
    });
  });

  it("só nota autorizada com PDF https", () => {
    const list = buildPortalInvoices([
      { id: "ok", data: { status: "authorized", type: "nfse", numero: 12, valorTotal: 300, pdfUrl: "https://focus/x.pdf", authorizedAt: "2026-09-01" } },
      { id: "cancelada", data: { status: "cancelled", pdfUrl: "https://focus/y.pdf" } },
      { id: "processando", data: { status: "processing", pdfUrl: "https://focus/z.pdf" } },
      { id: "sem-pdf", data: { status: "authorized" } },
      { id: "http", data: { status: "authorized", pdfUrl: "http://inseguro/a.pdf" } },
    ]);
    expect(list).toEqual([
      { id: "ok", type: "nfse", number: "12", amount: 300, issuedAt: "2026-09-01", pdfUrl: "https://focus/x.pdf" },
    ]);
  });

  it("só o primeiro nome do contato", () => {
    expect(firstName("  Ana Paula Ribeiro ")).toBe("Ana");
    expect(firstName(undefined)).toBe("");
  });
});
