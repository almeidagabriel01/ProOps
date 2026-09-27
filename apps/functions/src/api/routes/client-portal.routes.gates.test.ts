/**
 * Portal do cliente vende no Pro e no Enterprise: toda rota da empresa passa
 * pelo gate `clientPortal`, por prefixo. As públicas ficam em outro router, sem
 * gate de middleware (o plano é conferido pela empresa do token).
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
jest.mock("../controllers/client-portal.controller", () =>
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

import { clientPortalRoutes, publicClientPortalRoutes } from "./client-portal.routes";

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use("/v1", clientPortalRoutes);
  app.use("/v1/share/portal", publicClientPortalRoutes);
  app.get("/v1/outra-coisa", (_req, res) => res.json({ ok: true }));
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

afterAll(() => new Promise((r) => server.close(r)));

it.each([
  ["GET", "/client-portal/c1/link", "getClientPortalLink"],
  ["POST", "/client-portal/c1/link", "createClientPortalLink"],
  ["POST", "/client-portal/c1/link/rotate", "rotateClientPortalLink"],
  ["DELETE", "/client-portal/c1/link", "revokeClientPortalLink"],
])("%s %s exige a capacidade clientPortal e chega no handler certo", async (method, path, handler) => {
  hits.length = 0;
  const res = await fetch(`${base}${path}`, { method });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ handler });
  expect(hits).toEqual(["clientPortal"]);
});

it.each([
  ["GET", "/share/portal/tok_abcdefghijklmnop", "getPublicClientPortal"],
  ["POST", "/share/portal/tok_abcdefghijklmnop/open", "openPublicClientPortalItem"],
])("%s %s é público e não passa pelo gate de plano", async (method, path, handler) => {
  hits.length = 0;
  const res = await fetch(`${base}${path}`, { method });
  expect(await res.json()).toEqual({ handler });
  expect(hits).toEqual([]);
});

it("não aplica o gate fora do prefixo do módulo", async () => {
  hits.length = 0;
  const res = await fetch(`${base}/outra-coisa`);
  expect(res.status).toBe(200);
  expect(hits).toEqual([]);
});
