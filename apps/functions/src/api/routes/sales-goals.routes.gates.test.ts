/**
 * Metas de vendas vendem no Pro e no Enterprise: toda rota passa pelo gate
 * `salesGoals`, por prefixo, e nada fora do prefixo é gateado.
 */

import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

const hits: string[] = [];

jest.mock("../middleware/require-plan-capability", () => ({
  requirePlanCapability:
    (capability: string) =>
    (_req: express.Request, _res: express.Response, next: express.NextFunction) => {
      hits.push(capability);
      next();
    },
}));
jest.mock("../controllers/sales-goals.controller", () =>
  new Proxy(
    {},
    {
      get: (_t, name) =>
        name === "__esModule"
          ? false
          : (_req: express.Request, res: express.Response) => res.json({ handler: String(name) }),
    },
  ),
);

import { salesGoalsRoutes } from "./sales-goals.routes";

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use("/v1", salesGoalsRoutes);
  app.get("/v1/outra-coisa", (_req, res) => res.json({ ok: true }));
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

afterAll(() => new Promise((r) => server.close(r)));

it.each([
  ["GET", "/sales-goals?month=2026-09", "getSalesGoals"],
  ["PUT", "/sales-goals", "updateSalesGoals"],
  ["GET", "/sales-goals/progress?month=2026-09", "getSalesGoalsProgress"],
  ["GET", "/sales-goals/sellers", "listSellers"],
  ["GET", "/sales-goals/my-commissions?month=2026-10", "getMyCommissions"],
])("%s %s exige a capacidade salesGoals e chega no handler certo", async (method, path, handler) => {
  hits.length = 0;
  const res = await fetch(`${base}${path}`, { method });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ handler });
  expect(hits).toEqual(["salesGoals"]);
});

it("não aplica o gate fora do prefixo do módulo", async () => {
  hits.length = 0;
  const res = await fetch(`${base}/outra-coisa`);
  expect(res.status).toBe(200);
  expect(hits).toEqual([]);
});
