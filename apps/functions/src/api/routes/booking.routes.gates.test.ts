/**
 * Link de agendamento vende no Pro e no Enterprise: toda rota da empresa passa
 * pelo gate `bookingLink`, por prefixo. As públicas ficam em outro router, sem
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
jest.mock("../controllers/booking.controller", () =>
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

import { bookingRoutes, publicBookingRoutes } from "./booking.routes";

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use("/v1", bookingRoutes);
  app.use("/v1/public/booking", publicBookingRoutes);
  app.get("/v1/outra-coisa", (_req, res) => res.json({ ok: true }));
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

afterAll(() => new Promise((r) => server.close(r)));

it.each([
  ["GET", "/booking/settings", "getBookingSettings"],
  ["PUT", "/booking/settings", "updateBookingSettings"],
  ["GET", "/booking/requests", "listBookingRequests"],
  ["POST", "/booking/requests/r1/confirm", "confirmBooking"],
  ["POST", "/booking/requests/r1/decline", "declineBooking"],
])("%s %s exige a capacidade bookingLink e chega no handler certo", async (method, path, handler) => {
  hits.length = 0;
  const res = await fetch(`${base}${path}`, { method });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ handler });
  expect(hits).toEqual(["bookingLink"]);
});

it.each([
  ["GET", "/public/booking/tok_abcdefgh", "getPublicBooking"],
  ["POST", "/public/booking/tok_abcdefgh", "submitPublicBooking"],
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
