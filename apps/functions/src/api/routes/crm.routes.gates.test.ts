/**
 * Leads e atividades vendem junto do CRM: toda rota passa pelo gate `crm`, e
 * o gate é por prefixo, então uma rota de fora do módulo não é tocada.
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

const stubController = () =>
  new Proxy(
    {},
    {
      get: (_t, name) =>
        name === "__esModule"
          ? false
          : (_req: express.Request, res: express.Response) => res.json({ handler: String(name) }),
    },
  );
jest.mock("../controllers/leads.controller", () => stubController());
jest.mock("../controllers/activities.controller", () => stubController());

import { crmRoutes } from "./crm.routes";

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use("/v1", crmRoutes);
  app.get("/v1/outra-coisa", (_req, res) => res.json({ ok: true }));
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

afterAll(() => new Promise((r) => server.close(r)));

it.each([
  ["GET", "/leads", "listLeads"],
  ["POST", "/leads", "createLead"],
  ["PUT", "/leads/l1", "updateLead"],
  ["DELETE", "/leads/l1", "deleteLead"],
  ["POST", "/leads/l1/convert", "convertLead"],
  ["GET", "/activities?leadId=l1", "listActivities"],
  ["POST", "/activities", "createActivity"],
  ["PUT", "/activities/a1", "updateActivity"],
  ["DELETE", "/activities/a1", "deleteActivity"],
])("%s %s exige a capacidade crm", async (method, path, handler) => {
  hits.length = 0;
  const res = await fetch(`${base}${path}`, { method });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ handler });
  expect(hits).toEqual(["crm"]);
});

it("não aplica o gate fora dos prefixos do módulo", async () => {
  hits.length = 0;
  const res = await fetch(`${base}/outra-coisa`);
  expect(res.status).toBe(200);
  expect(hits).toEqual([]);
});
