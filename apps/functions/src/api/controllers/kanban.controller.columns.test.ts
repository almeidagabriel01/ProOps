/**
 * Colunas do quadro: criar, editar, reordenar e excluir pedem, além da ação
 * de sempre, "Colunas" (catálogo de permissões, página kanban), que ausente
 * vale o "Editar". Quem mexe nos cartões pode não mexer nas colunas.
 */
import type { Request, Response } from "express";

const perms = new Map<string, boolean>();
jest.mock("../../lib/auth-helpers", () => {
  const { resolvePermissionKey } = jest.requireActual("../../shared/permission-catalog");
  return {
    hasPagePermission: async (_claims: unknown, pageId: string, key: string) => {
      const doc: Record<string, boolean> = {};
      for (const [k, v] of perms) {
        const [page, field] = k.split(".");
        if (page === pageId) doc[field] = v;
      }
      return resolvePermissionKey(pageId, doc, key);
    },
  };
});
jest.mock("../../init", () => ({
  db: {
    collection: () => {
      throw new Error("não deveria chegar ao banco");
    },
  },
}));

import {
  createKanbanStatus,
  deleteKanbanStatus,
  reorderKanbanStatuses,
  updateKanbanStatus,
} from "./kanban.controller";

function fakeRes() {
  const res = {
    statusCode: 200,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json() {
      return res;
    },
  };
  return res as unknown as Response & { statusCode: number };
}

const req = (body: Record<string, unknown> = {}) =>
  ({ user: { uid: "m1", tenantId: "t1", role: "MEMBER" }, params: { id: "c1" }, body }) as unknown as Request;

describe("colunas do quadro", () => {
  it("com 'Colunas' desligada, nenhuma operação de coluna passa", async () => {
    perms.clear();
    for (const k of ["canView", "canCreate", "canEdit", "canDelete"]) perms.set(`kanban.${k}`, true);
    perms.set("kanban.columns", false);
    for (const handler of [createKanbanStatus, updateKanbanStatus, deleteKanbanStatus, reorderKanbanStatuses]) {
      const res = fakeRes();
      await handler(req({ label: "Nova", statuses: [] }), res);
      expect(res.statusCode).toBe(403);
    }
  });
});
