process.env.NODE_ENV = "test";

const mockUserGet = jest.fn();
const mockTenantGet = jest.fn();

jest.mock("../../../init", () => ({
  db: {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: name === "users" ? () => mockUserGet(id) : () => mockTenantGet(id),
      }),
    }),
  },
  auth: {},
  adminApp: {},
}));

import { Request, Response } from "express";
import { resolveIdentities } from "../observability-admin.controller";

function mockRes() {
  const res: Partial<Response> & { _status?: number; _json?: unknown } = {};
  res.status = ((code: number) => { res._status = code; return res as Response; }) as Response["status"];
  res.json = ((body: unknown) => { res._json = body; return res as Response; }) as Response["json"];
  return res as Response & { _status?: number; _json?: unknown };
}

function superReq(body: unknown): Request {
  return { body, user: { uid: "u", isSuperAdmin: true, role: "SUPERADMIN", tenantId: "" } } as unknown as Request;
}

beforeEach(() => {
  mockUserGet.mockReset();
  mockTenantGet.mockReset();
});

it("rejects non-superadmin with 403", async () => {
  const req = { body: { uids: [], tenantIds: [] }, user: { isSuperAdmin: false } } as unknown as Request;
  const res = mockRes();
  await resolveIdentities(req, res);
  expect(res._status).toBe(403);
});

it("resolves users and tenants, dedups repeated ids, omits missing docs", async () => {
  mockUserGet.mockImplementation((id: string) =>
    Promise.resolve(
      id === "u1"
        ? { exists: true, data: () => ({ name: "Alice", email: "a@x.com" }) }
        : { exists: false, data: () => undefined },
    ),
  );
  mockTenantGet.mockImplementation((id: string) =>
    Promise.resolve({ exists: true, data: () => ({ name: id === "t1" ? "Acme" : "Other" }) }),
  );

  const res = mockRes();
  await resolveIdentities(superReq({ uids: ["u1", "u1", "u2"], tenantIds: ["t1"] }), res);

  expect(res._status).toBe(200);
  expect(mockUserGet).toHaveBeenCalledTimes(2); // deduped u1
  expect((res._json as { users: Record<string, unknown> }).users).toEqual({
    u1: { name: "Alice", email: "a@x.com" },
  });
  expect((res._json as { tenants: Record<string, unknown> }).tenants).toEqual({
    t1: { name: "Acme" },
  });
});

it("returns 400 when uids is not an array", async () => {
  const res = mockRes();
  await resolveIdentities(superReq({ uids: "nope", tenantIds: [] }), res);
  expect(res._status).toBe(400);
});

it("returns 400 when over the 100-id cap", async () => {
  const res = mockRes();
  const uids = Array.from({ length: 101 }, (_, i) => `u${i}`);
  await resolveIdentities(superReq({ uids, tenantIds: [] }), res);
  expect(res._status).toBe(400);
});
