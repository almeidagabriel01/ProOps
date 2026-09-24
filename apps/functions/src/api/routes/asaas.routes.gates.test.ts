/**
 * O Asaas (pagamento online) atravessa DOIS gates: o financeiro, porque o
 * dinheiro recebido vira lancamento e carteira, e o `onlinePayments`, nativo so
 * no Enterprise e vendido como add-on. Ate 2026-09 bastava o financeiro, e o
 * Pro tinha pagamento online incluido.
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
jest.mock("../middleware/auth", () => ({
  validateFirebaseIdToken: (
    _req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => next(),
}));
jest.mock("../controllers/asaas.controller", () =>
  new Proxy(
    {},
    {
      get: (_t, name) =>
        name === "__esModule"
          ? false
          : (_req: express.Request, res: express.Response) =>
              res.json({ handler: String(name) }),
    },
  ),
);

import { asaasRoutes } from "./asaas.routes";

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use("/v1", asaasRoutes);
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

afterAll(() => new Promise((r) => server.close(r)));

it.each([
  ["POST", "/asaas/connect"],
  ["GET", "/asaas/status"],
  ["DELETE", "/asaas/disconnect"],
  ["PUT", "/asaas/payout"],
  ["POST", "/asaas/webhook/retry"],
])("%s %s exige financeiro E pagamento online", async (method, path) => {
  hits.length = 0;
  const res = await fetch(`${base}${path}`, { method });
  expect(res.status).toBe(200);
  expect(hits).toEqual(["financial", "onlinePayments"]);
});
