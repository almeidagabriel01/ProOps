/**
 * Assistência técnica vende no Pro e no Enterprise (e no Starter pelo add-on):
 * toda rota de equipamentos e OS passa pelo gate `fieldService`, por prefixo.
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
jest.mock("../controllers/field-service.controller", () =>
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

import { fieldServiceRoutes } from "./field-service.routes";

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use("/v1", fieldServiceRoutes);
  app.get("/v1/outra-coisa", (_req, res) => res.json({ ok: true }));
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

afterAll(() => new Promise((r) => server.close(r)));

it.each([
  ["POST", "/equipment", "createEquipment"],
  ["PUT", "/equipment/e1", "updateEquipment"],
  ["DELETE", "/equipment/e1", "deleteEquipment"],
  ["GET", "/service-orders/technicians", "listTechnicians"],
  ["POST", "/service-orders", "createServiceOrder"],
  ["PUT", "/service-orders/o1", "updateServiceOrder"],
  ["DELETE", "/service-orders/o1", "deleteServiceOrder"],
  ["POST", "/service-orders/o1/status", "changeServiceOrderStatus"],
  ["POST", "/service-orders/o1/complete", "completeServiceOrder"],
  ["POST", "/service-orders/o1/reopen", "reopenServiceOrder"],
  ["POST", "/service-orders/o1/photos", "uploadServiceOrderPhoto"],
  ["DELETE", "/service-orders/o1/photos/f1", "deleteServiceOrderPhoto"],
])("%s %s exige a capacidade fieldService e chega no handler certo", async (method, path, handler) => {
  hits.length = 0;
  const res = await fetch(`${base}${path}`, { method });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ handler });
  expect(hits).toEqual(["fieldService"]);
});

it("não aplica o gate fora do prefixo do módulo", async () => {
  hits.length = 0;
  const res = await fetch(`${base}/outra-coisa`);
  expect(res.status).toBe(200);
  expect(hits).toEqual([]);
});
