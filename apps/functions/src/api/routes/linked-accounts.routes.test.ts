/**
 * A rota de Contas vinculadas NAO tem gate de plano: um plano sem uma das
 * integracoes recebe o resumo com o item marcado, nao 402. E o tenant vem de
 * req.user, nunca de cabecalho ou corpo.
 */

import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

const getLinkedAccounts = jest.fn();

jest.mock("../services/linked-accounts.service", () => ({
  getLinkedAccounts: (...args: unknown[]) => getLinkedAccounts(...args),
}));
jest.mock("../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { linkedAccountsRoutes } from "./linked-accounts.routes";

let server: Server;
let base: string;
let currentUser: Record<string, unknown> | undefined;

beforeAll(async () => {
  const app = express();
  app.use((req, _res, next) => {
    (req as unknown as { user: unknown }).user = currentUser;
    next();
  });
  app.use("/v1", linkedAccountsRoutes);
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

afterAll(() => new Promise((r) => server.close(r)));

beforeEach(() => {
  getLinkedAccounts.mockReset();
  getLinkedAccounts.mockResolvedValue([{ id: "fiscal", status: "not_in_plan" }]);
});

it("membro recebe 200 com a lista, e o tenant vem de req.user", async () => {
  currentUser = { uid: "u1", tenantId: "tenant-a", role: "MEMBER", isSuperAdmin: false };
  const res = await fetch(`${base}/linked-accounts`, {
    headers: { "x-tenant-id": "tenant-intruso" },
  });
  expect(res.status).toBe(200);
  await expect(res.json()).resolves.toEqual({
    accounts: [{ id: "fiscal", status: "not_in_plan" }],
  });
  expect(getLinkedAccounts).toHaveBeenCalledWith("tenant-a", "u1", {
    role: "MEMBER",
    isSuperAdmin: false,
  });
});

it("superadmin vendo outra empresa le o tenant ja trocado pela impersonacao", async () => {
  currentUser = { uid: "sa", tenantId: "tenant-alvo", role: "SUPERADMIN", isSuperAdmin: true };
  const res = await fetch(`${base}/linked-accounts`);
  expect(res.status).toBe(200);
  expect(getLinkedAccounts).toHaveBeenCalledWith("tenant-alvo", "sa", {
    role: "SUPERADMIN",
    isSuperAdmin: true,
  });
});

it("sem tenant nas claims: 403", async () => {
  currentUser = { uid: "u1", tenantId: "", role: "MEMBER" };
  const res = await fetch(`${base}/linked-accounts`);
  expect(res.status).toBe(403);
  expect(getLinkedAccounts).not.toHaveBeenCalled();
});

it("falha ao montar a lista: 500 sem detalhe interno", async () => {
  currentUser = { uid: "u1", tenantId: "tenant-a", role: "MASTER" };
  getLinkedAccounts.mockRejectedValueOnce(new Error("firestore caiu"));
  const res = await fetch(`${base}/linked-accounts`);
  expect(res.status).toBe(500);
  const body = await res.json();
  expect(JSON.stringify(body)).not.toContain("firestore caiu");
});
