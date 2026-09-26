/**
 * Lembrete "cliente viu e ainda não respondeu": um aviso por link, só para
 * proposta que continua aberta.
 */

let sharedDocs: Array<{ id: string; data: Record<string, unknown> }>;
let proposals: Record<string, Record<string, unknown>>;
let kanban: Record<string, Record<string, unknown>>;
let lastQuery: { wheres: unknown[][] };

jest.mock("./init", () => ({
  db: {
    collection: (name: string) => {
      if (name === "shared_proposals") {
        const q = {
          wheres: [] as unknown[][],
          where(...args: unknown[]) {
            q.wheres.push(args);
            lastQuery = q;
            return q;
          },
          orderBy: () => q,
          limit: () => q,
          startAfter: () => q,
          get: async () => ({
            size: sharedDocs.length,
            docs: sharedDocs.map((d) => ({
              id: d.id,
              data: () => d.data,
              ref: { path: `shared_proposals/${d.id}` },
            })),
          }),
        };
        return q;
      }
      if (name === "proposals") {
        return {
          doc: (id: string) => ({
            get: async () => ({ id, data: () => proposals[id] }),
          }),
        };
      }
      if (name === "kanban_statuses") {
        return {
          doc: (id: string) => ({ get: async () => ({ data: () => kanban[id] }) }),
        };
      }
      if (name === "notifications") {
        return { doc: (id: string) => ({ path: `notifications/${id}` }) };
      }
      throw new Error(`coleção inesperada: ${name}`);
    },
  },
}));

import {
  FOLLOW_UP_AFTER_DAYS,
  buildFollowUpNotification,
  followUpCutoffIso,
  isProposalAwaitingClient,
  runProposalFollowUps,
} from "./proposal-follow-up";

function fakeWriter() {
  return {
    set: jest.fn(),
    update: jest.fn(),
  } as unknown as FirebaseFirestore.BulkWriter & { set: jest.Mock; update: jest.Mock };
}

const NOW = new Date("2026-09-25T12:00:00.000Z");

beforeEach(() => {
  sharedDocs = [];
  proposals = {};
  kanban = {};
});

describe("isProposalAwaitingClient", () => {
  it("proposta enviada ou em aberto espera resposta", async () => {
    expect(await isProposalAwaitingClient({ status: "sent" })).toBe(true);
    expect(await isProposalAwaitingClient({ status: "in_progress" })).toBe(true);
  });

  it("aprovada, recusada, rascunho ou com aceite não espera", async () => {
    for (const status of ["approved", "rejected", "draft"]) {
      expect(await isProposalAwaitingClient({ status })).toBe(false);
    }
    expect(await isProposalAwaitingClient({ status: "sent", clientAcceptance: {} })).toBe(false);
  });

  it("aceite pendente já é resposta; descartado ou anulado volta a esperar o cliente", async () => {
    expect(
      await isProposalAwaitingClient({ status: "sent", clientAcceptance: { status: "pending" } }),
    ).toBe(false);
    for (const status of ["discarded", "invalidated"]) {
      expect(
        await isProposalAwaitingClient({ status: "sent", clientAcceptance: { status } }),
      ).toBe(true);
    }
  });

  it("coluna personalizada ganha ou perdida já teve resposta", async () => {
    kanban = {
      ganha: { category: "won" },
      perdida: { category: "lost" },
      negociando: { category: "open" },
    };
    expect(await isProposalAwaitingClient({ status: "ganha" })).toBe(false);
    expect(await isProposalAwaitingClient({ status: "perdida" })).toBe(false);
    expect(await isProposalAwaitingClient({ status: "negociando" })).toBe(true);
  });
});

describe("buildFollowUpNotification", () => {
  it("diz quem viu, qual proposta e há quantos dias", () => {
    const n = buildFollowUpNotification({
      tenantId: "t1",
      proposalId: "p1",
      sharedProposalId: "s1",
      title: "Casa da Maria",
      clientName: "Maria Souza",
    });
    expect(n.type).toBe("proposal_follow_up");
    expect(n.message).toContain("Maria Souza");
    expect(n.message).toContain(`há ${FOLLOW_UP_AFTER_DAYS} dias`);
    expect(n.message).not.toContain("—");
  });
});

describe("runProposalFollowUps", () => {
  it("consulta os links pendentes vistos antes do corte", async () => {
    await runProposalFollowUps(NOW, fakeWriter());
    expect(lastQuery.wheres).toEqual([
      ["followUpPending", "==", true],
      ["firstViewedAt", "<=", followUpCutoffIso(NOW)],
    ]);
    expect(followUpCutoffIso(NOW)).toBe("2026-09-22T12:00:00.000Z");
  });

  it("avisa proposta aberta e desmarca o link", async () => {
    sharedDocs = [{ id: "s1", data: { tenantId: "t1", proposalId: "p1" } }];
    proposals = { p1: { tenantId: "t1", status: "sent", title: "Casa", clientName: "Ana" } };
    const writer = fakeWriter();

    expect(await runProposalFollowUps(NOW, writer)).toBe(1);
    expect(writer.set).toHaveBeenCalledWith(
      { path: "notifications/followup_s1" },
      expect.objectContaining({ tenantId: "t1", type: "proposal_follow_up", isRead: false }),
      { merge: true },
    );
    expect(writer.update).toHaveBeenCalledWith(
      { path: "shared_proposals/s1" },
      { followUpPending: false },
    );
  });

  it("proposta já respondida só desmarca, sem avisar", async () => {
    sharedDocs = [{ id: "s1", data: { tenantId: "t1", proposalId: "p1" } }];
    proposals = { p1: { tenantId: "t1", status: "approved" } };
    const writer = fakeWriter();

    expect(await runProposalFollowUps(NOW, writer)).toBe(0);
    expect(writer.set).not.toHaveBeenCalled();
    expect(writer.update).toHaveBeenCalledWith(
      { path: "shared_proposals/s1" },
      { followUpPending: false },
    );
  });

  it("link de outra empresa ou proposta apagada não gera aviso", async () => {
    sharedDocs = [
      { id: "s1", data: { tenantId: "t1", proposalId: "p1" } },
      { id: "s2", data: { tenantId: "t1", proposalId: "sumiu" } },
    ];
    proposals = { p1: { tenantId: "outro", status: "sent" } };
    const writer = fakeWriter();

    expect(await runProposalFollowUps(NOW, writer)).toBe(0);
    expect(writer.set).not.toHaveBeenCalled();
  });
});
