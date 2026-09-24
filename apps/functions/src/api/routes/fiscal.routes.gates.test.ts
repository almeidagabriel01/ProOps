/**
 * Quais gates de plano cada rota fiscal atravessa.
 *
 * O add-on fiscal (Starter/Pro) abre a EMISSAO, com franquia. A recepcao de
 * notas de entrada fica so no Enterprise, porque consome unidade paga do Focus
 * sem clique de ninguem. A defesa e o prefixo: uma rota de recebidas montada
 * fora de `/fiscal/received-invoices` ficaria aberta a quem so tem o add-on.
 *
 * Sobe o router de verdade num servidor efemero, como
 * `finance.routes.commissions.test.ts`.
 */

import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

const hits: Array<{ capability: string; url: string }> = [];

jest.mock("../middleware/require-plan-capability", () => ({
  requirePlanCapability:
    (capability: string) =>
    (req: express.Request, _res: express.Response, next: express.NextFunction) => {
      hits.push({ capability, url: req.originalUrl });
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
jest.mock("../../ai/field-gen-rate-limiter", () => ({
  fieldGenRateLimiter: (
    _req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => next(),
}));

const anyHandler = () =>
  new Proxy(
    {},
    {
      get: (_t, name) =>
        name === "__esModule"
          ? false
          : (_req: express.Request, res: express.Response) =>
              res.json({ handler: String(name) }),
    },
  );
jest.mock("../controllers/fiscal.controller", () => anyHandler());
jest.mock("../controllers/received-invoice.controller", () => anyHandler());

import { fiscalRoutes } from "./fiscal.routes";

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use("/v1", fiscalRoutes);
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

afterAll(() => new Promise((r) => server.close(r)));

beforeEach(() => {
  hits.length = 0;
});

async function gatesFor(method: string, path: string): Promise<string[]> {
  hits.length = 0;
  const res = await fetch(`${base}${path}`, { method });
  expect(res.status).toBe(200);
  return hits.map((h) => h.capability);
}

describe("gates das rotas fiscais", () => {
  it("emissao e franquia passam so pelo gate fiscal", async () => {
    expect(await gatesFor("POST", "/fiscal/invoices/from-proposal/p1")).toEqual(["fiscal"]);
    expect(await gatesFor("GET", "/fiscal/invoices/quota")).toEqual(["fiscal"]);
  });

  it.each([
    ["GET", "/fiscal/received-invoices"],
    ["POST", "/fiscal/received-invoices/sync"],
    ["GET", "/fiscal/received-invoices/123"],
    ["POST", "/fiscal/received-invoices/123/manifestacao"],
    ["POST", "/fiscal/received-invoices/123/lancamento"],
  ])("%s %s exige tambem a recepcao (so Enterprise)", async (method, path) => {
    expect(await gatesFor(method, path)).toEqual(["fiscal", "fiscalReceiving"]);
  });
});
