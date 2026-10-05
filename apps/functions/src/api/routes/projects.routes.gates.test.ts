/**
 * Projetos vendem no Pro e no Enterprise: toda rota passa pelo gate
 * `projects`, por prefixo, e `/projects/settings` não cai no `/:id`.
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
jest.mock("../controllers/projects.controller", () =>
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

import { projectsRoutes } from "./projects.routes";

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use("/v1", projectsRoutes);
  app.get("/v1/outra-coisa", (_req, res) => res.json({ ok: true }));
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

afterAll(() => new Promise((r) => server.close(r)));

it.each([
  ["GET", "/projects/settings", "getProjectSettings"],
  ["PUT", "/projects/settings", "updateProjectSettings"],
  ["GET", "/projects/assignees", "listProjectAssignees"],
  ["POST", "/projects", "createProject"],
  ["PUT", "/projects/p1", "updateProject"],
  ["DELETE", "/projects/p1", "deleteProject"],
  ["POST", "/projects/p1/delivery-link", "createDeliveryLink"],
  ["POST", "/projects/p1/items/import", "importProjectItems"],
  ["PUT", "/projects/p1/items/status", "updateProjectItemsStatus"],
  ["PUT", "/projects/p1/stages/s1", "updateStage"],
  ["POST", "/projects/p1/stages/s1/checklist", "addChecklistItem"],
  ["PUT", "/projects/p1/stages/s1/checklist/i1", "toggleChecklistItem"],
  ["DELETE", "/projects/p1/stages/s1/checklist/i1", "deleteChecklistItem"],
  ["POST", "/projects/p1/stages/s1/photos", "uploadStagePhoto"],
  ["DELETE", "/projects/p1/stages/s1/photos/f1", "deleteStagePhoto"],
  ["PUT", "/projects/p1/stages/s1/schedule", "scheduleStage"],
  ["DELETE", "/projects/p1/stages/s1/schedule", "unscheduleStage"],
])("%s %s exige a capacidade projects e chega no handler certo", async (method, path, handler) => {
  hits.length = 0;
  const res = await fetch(`${base}${path}`, { method });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ handler });
  expect(hits).toEqual(["projects"]);
});

it("não aplica o gate fora do prefixo do módulo", async () => {
  hits.length = 0;
  const res = await fetch(`${base}/outra-coisa`);
  expect(res.status).toBe(200);
  expect(hits).toEqual([]);
});
