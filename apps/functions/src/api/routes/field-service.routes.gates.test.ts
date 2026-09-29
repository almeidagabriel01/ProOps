/**
 * Assistência técnica vende no Pro e no Enterprise (e no Starter pelo add-on):
 * toda rota de equipamentos, OS e contratos passa pelo gate `fieldService`, por prefixo.
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
jest.mock("../controllers/service-contracts.controller", () =>
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

import { fieldServiceRoutes, publicFieldServiceRoutes } from "./field-service.routes";

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use("/v1", publicFieldServiceRoutes);
  app.use("/v1", fieldServiceRoutes);
  app.get("/v1/outra-coisa", (_req, res) => res.json({ ok: true }));
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

afterAll(() => new Promise((r) => server.close(r)));

it.each([
  ["POST", "/equipment", "createEquipment"],
  ["POST", "/equipment/batch", "createEquipmentBatch"],
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
  ["POST", "/service-orders/o1/share-link", "createServiceOrderShareLink"],
  ["POST", "/service-orders/o1/transaction", "launchServiceOrderTransaction"],
  ["GET", "/service-orders/o1/pdf", "downloadServiceOrderPdf"],
  ["POST", "/service-contracts", "createServiceContract"],
  ["PUT", "/service-contracts/c1", "updateServiceContract"],
  ["DELETE", "/service-contracts/c1", "deleteServiceContract"],
  ["POST", "/service-contracts/c1/activate", "activateServiceContract"],
  ["POST", "/service-contracts/c1/suspend", "suspendServiceContract"],
  ["POST", "/service-contracts/c1/resume", "resumeServiceContract"],
  ["POST", "/service-contracts/c1/end", "endServiceContract"],
])("%s %s exige a capacidade fieldService e chega no handler certo", async (method, path, handler) => {
  hits.length = 0;
  const res = await fetch(`${base}${path}`, { method });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ handler });
  expect(hits).toEqual(["fieldService"]);
});

it("o link público da OS não passa pelo gate nem pede usuário", async () => {
  hits.length = 0;
  const res = await fetch(`${base}/share/service-order/tok123`);
  expect(await res.json()).toEqual({ handler: "getSharedServiceOrder" });
  expect(hits).toEqual([]);
});

it("não aplica o gate fora do prefixo do módulo", async () => {
  hits.length = 0;
  const res = await fetch(`${base}/outra-coisa`);
  expect(res.status).toBe(200);
  expect(hits).toEqual([]);
});
