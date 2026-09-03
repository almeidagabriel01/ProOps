/**
 * Regressão: `checkFinancialPermission` lia um doc de permissão chamado
 * `financial` cravado no código, que nenhum caminho de escrita jamais criou —
 * a tela de Equipe sempre gravou `transactions` e `wallet`. O efeito era todo
 * MEMBER receber "Sem permissão financeira." em qualquer criação, edição ou
 * exclusão de lançamento e de carteira, independentemente do que o master
 * tivesse marcado, e os dois toggles da tela não fazerem nada.
 *
 * Estes testes falham se a função voltar a ler uma chave que a tela não grava.
 */

const permissionDocs = new Map<string, Record<string, boolean>>();
let userDoc: Record<string, unknown> | null = null;

jest.mock("../../init", () => ({
  db: {
    collection: jest.fn(() => ({
      doc: jest.fn((uid: string) => ({
        get: async () => ({
          exists: userDoc !== null,
          data: () => userDoc,
        }),
        collection: jest.fn(() => ({
          doc: jest.fn((pageId: string) => ({
            get: async () => {
              const key = `${uid}/${pageId}`;
              const data = permissionDocs.get(key);
              return { exists: data !== undefined, data: () => data };
            },
          })),
        })),
      })),
    })),
  },
}));

import { checkFinancialPermission } from "../finance-helpers";

const MEMBER_CLAIMS = {
  uid: "member-1",
  role: "MEMBER",
  tenantId: "tenant-1",
};

beforeEach(() => {
  permissionDocs.clear();
  userDoc = { role: "MEMBER", tenantId: "tenant-1", masterId: "master-1" };
});

function grant(pageId: string, flags: Record<string, boolean>) {
  permissionDocs.set(`member-1/${pageId}`, flags);
}

describe("checkFinancialPermission lê a chave que a tela de Equipe grava", () => {
  it.each([
    ["transactions", "canCreate"],
    ["transactions", "canEdit"],
    ["transactions", "canDelete"],
    ["wallet", "canCreate"],
    ["wallet", "canEdit"],
    ["wallet", "canDelete"],
  ] as const)("permite %s/%s quando o master concedeu", async (pageId, action) => {
    grant(pageId, { [action]: true });

    const result = await checkFinancialPermission(
      "member-1",
      pageId,
      action,
      MEMBER_CLAIMS,
    );

    expect(result.isMaster).toBe(false);
    expect(result.tenantId).toBe("tenant-1");
  });

  it("nega quando o membro não tem o doc da página", async () => {
    await expect(
      checkFinancialPermission("member-1", "transactions", "canCreate", MEMBER_CLAIMS),
    ).rejects.toThrow("Sem permissão financeira.");
  });

  it("nega quando o doc existe mas a ação está desligada", async () => {
    grant("transactions", { canView: true, canCreate: false });

    await expect(
      checkFinancialPermission("member-1", "transactions", "canCreate", MEMBER_CLAIMS),
    ).rejects.toThrow("Sem permissão financeira.");
  });

  it("não confunde as duas páginas: permissão de carteira não libera lançamento", async () => {
    grant("wallet", { canCreate: true });

    await expect(
      checkFinancialPermission("member-1", "transactions", "canCreate", MEMBER_CLAIMS),
    ).rejects.toThrow("Sem permissão financeira.");
  });

  it("um doc legado chamado financial NÃO libera nada", async () => {
    grant("financial", { canCreate: true, canEdit: true, canDelete: true });

    await expect(
      checkFinancialPermission("member-1", "transactions", "canCreate", MEMBER_CLAIMS),
    ).rejects.toThrow("Sem permissão financeira.");
    await expect(
      checkFinancialPermission("member-1", "wallet", "canCreate", MEMBER_CLAIMS),
    ).rejects.toThrow("Sem permissão financeira.");
  });
});

describe("master e superadmin seguem com bypass", () => {
  it("MASTER não precisa de doc de permissão", async () => {
    userDoc = { role: "MASTER", tenantId: "tenant-1" };

    const result = await checkFinancialPermission("member-1", "wallet", "canDelete", {
      uid: "member-1",
      role: "MASTER",
      tenantId: "tenant-1",
    });

    expect(result.isMaster).toBe(true);
  });

  it("SUPERADMIN não precisa de doc de permissão", async () => {
    userDoc = { role: "SUPERADMIN", tenantId: "tenant-1" };

    const result = await checkFinancialPermission("member-1", "transactions", "canDelete", {
      uid: "member-1",
      role: "SUPERADMIN",
      tenantId: "tenant-1",
    });

    expect(result.isSuperAdmin).toBe(true);
  });
});
