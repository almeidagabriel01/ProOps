/**
 * Ações finas da proposta: aprovar, dar desconto, trocar o responsável e
 * mexer nas comissões. Chave ausente vale o fallback do catálogo (Editar),
 * então quem já editava continua podendo tudo no dia do deploy; o que a
 * chave tira, ela tira só quando o dono a desliga.
 */

const perms = new Map<string, boolean>();
jest.mock("../../../lib/auth-helpers", () => {
  const { resolvePermissionKey } = jest.requireActual("../../../shared/permission-catalog");
  return {
    checkPermission: async (_uid: string, pageId: string, key: string) => {
      const doc: Record<string, boolean> = {};
      for (const [k, v] of perms) {
        const [page, field] = k.split(".");
        if (page === pageId) doc[field] = v;
      }
      return resolvePermissionKey(pageId, doc, key);
    },
  };
});

const clients: Record<string, Record<string, unknown>> = {};
jest.mock("../../../init", () => ({
  db: {
    collection: (name: string) => ({ doc: (id: string) => ({ id, name }) }),
    getAll: async (...refs: Array<{ id: string }>) =>
      refs.map((ref) => ({ id: ref.id, exists: Boolean(clients[ref.id]), data: () => clients[ref.id] })),
  },
}));

import { checkProposalFineActions } from "../proposal-fine-actions";
import {
  commissionsChangeIsAutomatic,
  discountChanged,
  sellerChanged,
} from "../proposal-fine-permissions";

const EDITOR = { "proposals.canView": true, "proposals.canEdit": true, "proposals.canCreate": true };

function grant(extra: Record<string, boolean> = {}) {
  perms.clear();
  for (const [k, v] of Object.entries({ ...EDITOR, ...extra })) perms.set(k, v);
}

const CURRENT = {
  discount: 5,
  closedValue: null,
  sellerId: "vendedora",
  partnerContactIds: ["arq1"],
  commissions: [{ contactId: "vend1", role: "vendedor", percentage: 3 }],
};

const base = (overrides: Partial<Parameters<typeof checkProposalFineActions>[0]> = {}) => ({
  userId: "vendedora",
  tenantId: "t1",
  current: CURRENT as Record<string, unknown>,
  input: { ...CURRENT } as Record<string, unknown>,
  commissionsAfter: null,
  approvalChanges: false,
  paidOnApproval: false,
  ...overrides,
});

beforeEach(() => {
  grant();
  for (const key of Object.keys(clients)) delete clients[key];
  clients.vend1 = { tenantId: "t1", commissionPercentage: 3 };
  clients.vend2 = { tenantId: "t1", commissionPercentage: 4 };
  clients.arq1 = { tenantId: "t1", commissionPercentage: 10 };
});

describe("comparação do que mudou", () => {
  it("desconto: vale o valor, não a presença do campo", () => {
    expect(discountChanged({ discount: 5 }, { discount: 5 })).toBe(false);
    expect(discountChanged({ discount: 5 }, { discount: 7 })).toBe(true);
    expect(discountChanged({ closedValue: null }, { closedValue: 0 })).toBe(false);
    expect(discountChanged({ closedValue: 1000 }, { closedValue: 900 })).toBe(true);
    expect(discountChanged({ discount: 5 }, {})).toBe(false);
  });

  it("responsável e parceiros: a ordem dos parceiros não conta", () => {
    expect(sellerChanged({ sellerId: "a", partnerContactIds: ["x", "y"] }, { sellerId: "a", partnerContactIds: ["y", "x"] })).toBe(false);
    expect(sellerChanged({ sellerId: "a" }, { sellerId: "b" })).toBe(true);
    expect(sellerChanged({ sellerId: "a", partnerContactIds: [] }, { partnerContactIds: ["x"] })).toBe(true);
  });

  it("comissão automática: a do vendedor que entra no percentual do cadastro", () => {
    const registry = new Map([["vend2", 4], ["arq1", 10]]);
    const before = [{ contactId: "vend1", role: "vendedor", percentage: 3 }];
    expect(commissionsChangeIsAutomatic(before, [{ contactId: "vend2", role: "vendedor", percentage: 4 }], registry)).toBe(true);
    expect(commissionsChangeIsAutomatic(before, [{ contactId: "vend2", role: "vendedor", percentage: 9 }], registry)).toBe(false);
    expect(commissionsChangeIsAutomatic([], [{ contactId: "arq1", role: "arquiteto", percentage: 10 }], registry)).toBe(false);
    expect(commissionsChangeIsAutomatic([{ contactId: "arq1", role: "arquiteto", percentage: 10 }], [], registry)).toBe(false);
  });
});

describe("quem só tem Editar (chaves ausentes) segue como antes", () => {
  it("aprova, dá desconto, troca o responsável e mexe nas comissões", async () => {
    expect(
      await checkProposalFineActions(
        base({
          approvalChanges: true,
          input: { ...CURRENT, discount: 20, sellerId: "outra" },
          commissionsAfter: [{ contactId: "arq1", role: "arquiteto", percentage: 15 }],
        }),
      ),
    ).toBeNull();
  });
});

describe("com as chaves desligadas", () => {
  it("aprovar e reverter pedem 'Aprovar'", async () => {
    grant({ "proposals.approve": false });
    expect(await checkProposalFineActions(base({ approvalChanges: true }))).toMatch(/aprovar/);
    expect(await checkProposalFineActions(base())).toBeNull();
  });

  it("aprovar com o pagamento recebido pede criar lançamentos", async () => {
    grant({ "transactions.canCreate": false });
    expect(await checkProposalFineActions(base({ approvalChanges: true, paidOnApproval: true }))).toMatch(/lançamentos/);
    grant({ "transactions.canView": true, "transactions.canCreate": true });
    expect(await checkProposalFineActions(base({ approvalChanges: true, paidOnApproval: true }))).toBeNull();
  });

  it("sem 'Desconto', salva a proposta com o desconto que já tinha, mas não muda", async () => {
    grant({ "proposals.discount": false });
    expect(await checkProposalFineActions(base())).toBeNull();
    expect(await checkProposalFineActions(base({ input: { ...CURRENT, discount: 10 } }))).toMatch(/desconto/);
    expect(await checkProposalFineActions(base({ input: { ...CURRENT, closedValue: 900 } }))).toMatch(/desconto/);
  });

  it("sem 'Trocar responsável', não muda o vendedor nem os parceiros", async () => {
    grant({ "proposals.changeSeller": false });
    expect(await checkProposalFineActions(base())).toBeNull();
    expect(await checkProposalFineActions(base({ input: { ...CURRENT, sellerId: "outra" } }))).toMatch(/responsável/);
    expect(
      await checkProposalFineActions(base({ input: { ...CURRENT, partnerContactIds: ["arq1", "arq2"] } })),
    ).toMatch(/responsável/);
  });

  it("sem 'Comissões', só passa a troca automática do vendedor", async () => {
    grant({ "proposals.commissions": false });
    expect(
      await checkProposalFineActions(base({ commissionsAfter: [{ contactId: "vend2", role: "vendedor", percentage: 4 }] })),
    ).toBeNull();
    expect(
      await checkProposalFineActions(base({ commissionsAfter: [{ contactId: "vend1", role: "vendedor", percentage: 8 }] })),
    ).toMatch(/comissões/);
    expect(
      await checkProposalFineActions(
        base({
          commissionsAfter: [
            { contactId: "vend1", role: "vendedor", percentage: 3 },
            { contactId: "arq1", role: "arquiteto", percentage: 10 },
          ],
        }),
      ),
    ).toMatch(/comissões/);
  });

  it("contato de outra empresa não vale como cadastro", async () => {
    grant({ "proposals.commissions": false });
    clients.vend2 = { tenantId: "t2", commissionPercentage: 4 };
    expect(
      await checkProposalFineActions(base({ commissionsAfter: [{ contactId: "vend2", role: "vendedor", percentage: 4 }] })),
    ).toMatch(/comissões/);
  });
});
