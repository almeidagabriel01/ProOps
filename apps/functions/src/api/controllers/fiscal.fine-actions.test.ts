/**
 * Ações finas das Notas Fiscais: cancelar (antes o "Excluir"), carta de
 * correção, manifestar e lançar a nota de entrada. Cada uma confere a chave
 * própria, que ausente vale a ação básica de antes.
 */
import type { Request, Response } from "express";

const mockAsked: string[] = [];
const mockDenied = new Set<string>();
jest.mock("../../init", () => ({ db: {}, admin: {} }));
jest.mock("../../lib/auth-helpers", () => ({
  resolveUserAndTenant: async () => ({ tenantId: "t1", isMaster: false, isSuperAdmin: false }),
  checkPermission: async (_uid: string, pageId: string, key: string) => {
    mockAsked.push(`${pageId}.${key}`);
    return !mockDenied.has(key);
  },
}));

import { cancelInvoiceHandler, correctInvoiceHandler } from "./fiscal.controller";
import { launchReceivedInvoiceHandler, manifestReceivedInvoiceHandler } from "./received-invoice.controller";

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

const req = () =>
  ({ user: { uid: "m1", tenantId: "t1", role: "MEMBER" }, params: { id: "n1", chave: "1".repeat(44) }, body: {} }) as unknown as Request;

beforeEach(() => {
  mockAsked.length = 0;
  mockDenied.clear();
});

it.each([
  ["cancelar", cancelInvoiceHandler, "cancel"],
  ["carta de correção", correctInvoiceHandler, "correct"],
  ["manifestar", manifestReceivedInvoiceHandler, "manifest"],
  ["lançar a nota de entrada", launchReceivedInvoiceHandler, "launchReceived"],
] as const)("%s confere a chave própria e recusa sem ela", async (_name, handler, key) => {
  mockDenied.add(key);
  const res = fakeRes();
  await handler(req(), res);
  expect(mockAsked).toContain(`invoices.${key}`);
  expect(res.statusCode).toBe(403);
});
