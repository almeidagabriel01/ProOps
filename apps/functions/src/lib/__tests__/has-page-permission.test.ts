/**
 * `hasPagePermission` é o gate usado pelos módulos padronizados depois do CRUD
 * original (kanban, planilhas, auxiliares). Ele tem que se comportar
 * exatamente como o `if (!isMaster && !isSuperAdmin) checkPermission(...)` que
 * products/services/clients/proposals repetem à mão — senão o mesmo toggle da
 * tela de Equipe passa a significar coisas diferentes por módulo.
 */

const permissionDocs = new Map<string, Record<string, boolean>>();

jest.mock("../../init", () => ({
  db: {
    collection: jest.fn(() => ({
      doc: jest.fn((uid: string) => ({
        collection: jest.fn(() => ({
          doc: jest.fn((pageId: string) => ({
            get: async () => {
              const data = permissionDocs.get(`${uid}/${pageId}`);
              return { exists: data !== undefined, data: () => data };
            },
          })),
        })),
      })),
    })),
  },
}));

import { hasPagePermission } from "../auth-helpers";

beforeEach(() => permissionDocs.clear());

describe("membro", () => {
  const member = { uid: "member-1", role: "MEMBER" };

  it("permite quando o master concedeu a ação naquela página", async () => {
    permissionDocs.set("member-1/kanban", { canCreate: true });
    await expect(hasPagePermission(member, "kanban", "canCreate")).resolves.toBe(
      true,
    );
  });

  it("nega quando o doc da página não existe", async () => {
    await expect(hasPagePermission(member, "kanban", "canCreate")).resolves.toBe(
      false,
    );
  });

  it("nega a ação desligada mesmo com o doc presente", async () => {
    permissionDocs.set("member-1/kanban", { canView: true, canDelete: false });
    await expect(hasPagePermission(member, "kanban", "canDelete")).resolves.toBe(
      false,
    );
  });

  it("não vaza permissão entre páginas", async () => {
    permissionDocs.set("member-1/spreadsheets", { canDelete: true });
    await expect(hasPagePermission(member, "kanban", "canDelete")).resolves.toBe(
      false,
    );
  });
});

describe("bypass de administradores do tenant", () => {
  it.each(["MASTER", "ADMIN", "WK", "SUPERADMIN"])(
    "%s passa sem doc de permissão",
    async (role) => {
      await expect(
        hasPagePermission({ uid: "u1", role }, "kanban", "canDelete"),
      ).resolves.toBe(true);
    },
  );

  it("aceita role em minúsculas vindo de claims legadas", async () => {
    await expect(
      hasPagePermission({ uid: "u1", role: "master" }, "kanban", "canDelete"),
    ).resolves.toBe(true);
  });
});

describe("contexto ausente", () => {
  it("nega quando não há uid", async () => {
    await expect(
      hasPagePermission({ role: "MASTER" }, "kanban", "canView"),
    ).resolves.toBe(false);
    await expect(
      hasPagePermission(undefined, "kanban", "canView"),
    ).resolves.toBe(false);
  });
});
