import {
  buildPortalInvoices,
  buildPortalPayments,
  buildPortalProjects,
  buildPortalProposals,
  classifyProposalStatus,
  firstName,
} from "./client-portal-model";

describe("status da proposta no portal", () => {
  it.each([
    ["approved", undefined, "approved"],
    ["default_2", undefined, "approved"],
    ["rejected", undefined, "rejected"],
    ["default_3", undefined, "rejected"],
    ["draft", undefined, "draft"],
    ["", undefined, "draft"],
    ["sent", undefined, "open"],
    ["col1", { mappedStatus: "approved" }, "approved"],
    ["col1", { category: "lost" }, "rejected"],
    ["col1", { label: "Ganhas" }, "approved"],
    ["col1", { label: "Rascunho" }, "draft"],
    ["col1", { label: "Negociação" }, "open"],
  ] as const)("%s (%j) é %s", (status, kanban, expected) => {
    expect(classifyProposalStatus(status, kanban)).toBe(expected);
  });
});

describe("propostas", () => {
  it("rascunho não aparece; aprovada vale o fechado; mais novas primeiro", () => {
    const list = buildPortalProposals(
      [
        { id: "a", data: { status: "draft", title: "Rascunho", createdAt: "2026-09-20" } },
        { id: "b", data: { status: "sent", title: "Casa", totalValue: 1000, createdAt: "2026-09-10" } },
        { id: "c", data: { status: "approved", title: "Loja", totalValue: 5000, closedValue: 4500, createdAt: "2026-09-15" } },
      ],
      new Map(),
    );
    expect(list.map((p) => [p.id, p.state, p.value])).toEqual([
      ["c", "approved", 4500],
      ["b", "open", 1000],
    ]);
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
      { id: "y", title: "Casa", status: "active", stagesDone: 1, stagesTotal: 3, deliveryAccepted: false },
    ]);
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
