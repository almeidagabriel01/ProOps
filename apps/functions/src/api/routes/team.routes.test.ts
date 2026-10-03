/**
 * A lista da equipe serve para escolher quem cuida de um cliente, o que vale
 * em todos os planos: a rota não pode ganhar gate de plano por engano.
 */

import express from "express";
import fs from "node:fs";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

jest.mock("../services/team-people", () => ({
  loadTeamPeople: async (tenantId: string) => [{ id: "ana", name: `Ana de ${tenantId}` }],
}));

import { teamRoutes } from "./team.routes";

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use((req, _res, next) => {
    (req as unknown as { user: unknown }).user = { uid: "u1", tenantId: "t1", role: "MEMBER" };
    next();
  });
  app.use("/v1", teamRoutes);
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

afterAll(() => new Promise((r) => server.close(r)));

it("membro de qualquer plano lista a equipe do próprio tenant", async () => {
  const res = await fetch(`${base}/team/people`);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ people: [{ id: "ana", name: "Ana de t1" }] });
});

it("a rota não monta gate de plano", () => {
  const source = fs.readFileSync(path.join(__dirname, "team.routes.ts"), "utf8");
  expect(source).not.toMatch(/requirePlanCapability/);
});
