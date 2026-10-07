jest.mock("../../init", () => ({ db: {} }));

import { resolveRecipients, type AudienceMember } from "./notification-audience";

function member(partial: Partial<AudienceMember> & { uid: string }): AudienceMember {
  return {
    email: `${partial.uid}@empresa.com`,
    isAdmin: false,
    permissions: {},
    preferences: undefined,
    ...partial,
  };
}

const dono = member({ uid: "dono", isAdmin: true });
const vendedor = member({ uid: "vendedor", permissions: { proposals: { canView: true } } });
const financeiro = member({ uid: "financeiro", permissions: { transactions: { canView: true } } });
const semVer = member({ uid: "sem-ver", permissions: { transactions: { canView: false, canEdit: true } } });
const equipe = [dono, vendedor, financeiro, semVer];

describe("quem recebe cada tipo", () => {
  it("financeiro vai para o dono e para quem vê lançamentos, não para o vendedor", () => {
    const { recipientUids } = resolveRecipients(equipe, "transaction_paid_online");
    expect(recipientUids).toEqual(["dono", "financeiro"]);
  });

  it("permissão sem 'Ver' não conta, mesmo com 'Editar' ligado", () => {
    expect(resolveRecipients(equipe, "transaction_due_reminder").recipientUids).not.toContain(
      "sem-ver",
    );
  });

  it("proposta vai para quem vê propostas", () => {
    expect(resolveRecipients(equipe, "proposal_accepted").recipientUids).toEqual(["dono", "vendedor"]);
  });

  it("aviso do sistema vai só para o dono e os administradores", () => {
    expect(resolveRecipients(equipe, "system").recipientUids).toEqual(["dono"]);
  });

  it("lembrete do CRM segue a permissão do CRM (pageId kanban)", () => {
    const crm = member({ uid: "crm", permissions: { kanban: { canView: true } } });
    expect(resolveRecipients([crm, vendedor], "lead_reminder").recipientUids).toEqual(["crm"]);
  });
});

describe("preferências", () => {
  it("sem escolha, o sino vem ligado e o e-mail segue o padrão do tipo", () => {
    const aceite = resolveRecipients([dono], "proposal_accepted");
    expect(aceite.recipientUids).toEqual(["dono"]);
    expect(aceite.emailRecipients).toEqual([{ uid: "dono", email: "dono@empresa.com" }]);

    const vista = resolveRecipients([dono], "proposal_viewed");
    expect(vista.recipientUids).toEqual(["dono"]);
    expect(vista.emailRecipients).toEqual([]);
  });

  it("desligar o sino tira da central sem desligar o e-mail", () => {
    const quieto = member({
      uid: "quieto",
      isAdmin: true,
      preferences: { proposal_accepted: { inApp: false } },
    });
    const result = resolveRecipients([quieto], "proposal_accepted");
    expect(result.recipientUids).toEqual([]);
    expect(result.emailRecipients).toHaveLength(1);
  });

  it("ligar e-mail num tipo que não sai por e-mail não tem efeito", () => {
    const insistente = member({
      uid: "i",
      isAdmin: true,
      preferences: { transaction_due_reminder: { email: true } },
    });
    expect(resolveRecipients([insistente], "transaction_due_reminder").emailRecipients).toEqual([]);
  });

  it("sem e-mail cadastrado, fica só na central", () => {
    const semEmail = member({ uid: "x", isAdmin: true, email: null });
    const result = resolveRecipients([semEmail], "proposal_accepted");
    expect(result.recipientUids).toEqual(["x"]);
    expect(result.emailRecipients).toEqual([]);
  });

  it("permissão manda antes da preferência: e-mail ligado não abre tipo que a pessoa não vê", () => {
    const curioso = member({ uid: "c", preferences: { transaction_paid_online: { email: true } } });
    expect(resolveRecipients([curioso], "transaction_paid_online")).toEqual({
      recipientUids: [],
      emailRecipients: [],
    });
  });
});

describe("avisos diretos (tarefa atribuída, menção)", () => {
  it("vão só para quem foi citado, sem olhar o módulo", () => {
    expect(resolveRecipients(equipe, "task_assigned", ["vendedor"]).recipientUids).toEqual(["vendedor"]);
  });

  it("o dono não recebe a menção de outra pessoa", () => {
    expect(resolveRecipients(equipe, "task_mentioned", ["financeiro"]).recipientUids).toEqual([
      "financeiro",
    ]);
  });

  it("uid que não é da empresa não vira destinatário", () => {
    expect(resolveRecipients(equipe, "task_assigned", ["intruso"]).recipientUids).toEqual([]);
  });

  it("sem lista de destinatários, ninguém", () => {
    expect(resolveRecipients(equipe, "task_assigned").recipientUids).toEqual([]);
  });

  it("atribuição sai por e-mail por padrão; o lembrete diário não", () => {
    expect(resolveRecipients(equipe, "task_assigned", ["vendedor"]).emailRecipients).toHaveLength(1);
    expect(resolveRecipients(equipe, "task_reminder", ["vendedor"]).emailRecipients).toEqual([]);
  });
});

describe("alcance 'só os meus' de quem recebe", () => {
  const vendedora = member({
    uid: "vend",
    permissions: { proposals: { canView: true, scope: "own" }, transactions: { canView: true, scope: "income" } },
  });
  const equipe = member({ uid: "todos", permissions: { proposals: { canView: true }, transactions: { canView: true } } });
  const dono = member({ uid: "dono", isAdmin: true });

  it("a proposta de outro vendedor não avisa quem vê só as próprias", () => {
    const { recipientUids } = resolveRecipients([vendedora, equipe, dono], "proposal_accepted", undefined, {
      sellerId: "outra",
    });
    expect(recipientUids).toEqual(["todos", "dono"]);
  });

  it("a proposta dela avisa", () => {
    const { recipientUids } = resolveRecipients([vendedora, equipe], "proposal_accepted", undefined, {
      sellerId: "vend",
    });
    expect(recipientUids).toEqual(["vend", "todos"]);
  });

  it("sem o registro, quem tem o alcance restrito não recebe", () => {
    const { recipientUids } = resolveRecipients([vendedora, equipe], "proposal_accepted");
    expect(recipientUids).toEqual(["todos"]);
  });

  it("'só receitas' recebe o lembrete de receita e não o de despesa", () => {
    expect(
      resolveRecipients([vendedora], "transaction_due_reminder", undefined, { type: "income" }).recipientUids,
    ).toEqual(["vend"]);
    expect(
      resolveRecipients([vendedora], "transaction_due_reminder", undefined, { type: "expense" }).recipientUids,
    ).toEqual([]);
  });
});
