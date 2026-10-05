/**
 * Tabelas de preço vendem no Pro e no Enterprise: toda rota passa pelo gate
 * `priceTables`, por prefixo, e nada fora do prefixo é gateado.
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
jest.mock("../controllers/price-tables.controller", () =>
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

import { priceTablesRoutes } from "./price-tables.routes";

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use("/v1", priceTablesRoutes);
  app.get("/v1/products", (_req, res) => res.json({ ok: true }));
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

afterAll(() => new Promise((r) => server.close(r)));

it.each([
  ["GET", "/price-tables", "listPriceTablesHandler"],
  ["GET", "/price-tables/options", "listPriceTableOptionsHandler"],
  ["POST", "/price-tables", "createPriceTableHandler"],
  ["GET", "/price-tables/t1", "getPriceTableHandler"],
  ["PUT", "/price-tables/t1", "updatePriceTableHandler"],
  ["DELETE", "/price-tables/t1", "deletePriceTableHandler"],
])("%s %s exige a capacidade priceTables e chega no handler certo", async (method, path, handler) => {
  hits.length = 0;
  const res = await fetch(`${base}${path}`, { method });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ handler });
  expect(hits).toEqual(["priceTables"]);
});

it("não aplica o gate fora do prefixo do módulo (o catálogo segue aberto)", async () => {
  hits.length = 0;
  const res = await fetch(`${base}/products`);
  expect(res.status).toBe(200);
  expect(hits).toEqual([]);
});
