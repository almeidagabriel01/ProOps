/**
 * Requires the Firestore emulator on 127.0.0.1:8080.
 * Run: cd apps/functions && npx firebase emulators:exec --only firestore "npx jest src/api/controllers/__tests__/observability-admin.controller.test.ts"
 */
import type { Request, Response } from "express";
import { triageIssue, mapTriageErrorStatus } from "../observability-admin.controller";
import { db } from "../../../init";
import { ERROR_ISSUES_COLLECTION } from "../../../lib/observability/error-ingest.service";

function mockRes() {
  const res: Partial<Response> & { _status?: number; _json?: unknown } = {};
  res.status = ((code: number) => {
    res._status = code;
    return res as Response;
  }) as Response["status"];
  res.json = ((body: unknown) => {
    res._json = body;
    return res as Response;
  }) as Response["json"];
  return res as Response & { _status?: number; _json?: unknown };
}

function superAdminReq(fingerprint: string, status: string): Request {
  return {
    params: { fingerprint },
    body: { status },
    path: `/v1/admin/observability/issues/${fingerprint}/status`,
    user: { uid: "uid-super", isSuperAdmin: true, role: "SUPERADMIN", tenantId: "" },
  } as unknown as Request;
}

const FP = "a".repeat(40);

async function seedIssue(status = "unresolved", resolvedAt: string | null = null) {
  await db.collection(ERROR_ISSUES_COLLECTION).doc(FP).set({
    fingerprint: FP, status, resolvedAt, count: 3, severity: "critical",
  });
}
async function wipe() {
  await db.recursiveDelete(db.collection(ERROR_ISSUES_COLLECTION));
}

describe("mapTriageErrorStatus", () => {
  it("maps invalid to 400, not found to 404, forbidden to 403, else 500", () => {
    expect(mapTriageErrorStatus("status inválido")).toBe(400);
    expect(mapTriageErrorStatus("issue não encontrada")).toBe(404);
    expect(mapTriageErrorStatus("FORBIDDEN_NOT_SUPERADMIN")).toBe(403);
    expect(mapTriageErrorStatus("kaboom")).toBe(500);
  });
});

describe("triageIssue", () => {
  beforeEach(wipe);
  afterAll(wipe);

  it("rejects a non-superadmin with 403", async () => {
    await seedIssue();
    const req = { ...superAdminReq(FP, "resolved"), user: { uid: "u", isSuperAdmin: false, role: "ADMIN", tenantId: "t" } } as unknown as Request;
    const res = mockRes();
    await triageIssue(req, res);
    expect(res._status).toBe(403);
  });

  it("rejects an invalid status with 400", async () => {
    await seedIssue();
    const res = mockRes();
    await triageIssue(superAdminReq(FP, "bogus"), res);
    expect(res._status).toBe(400);
  });

  it("404s when the issue does not exist", async () => {
    const res = mockRes();
    await triageIssue(superAdminReq(FP, "resolved"), res);
    expect(res._status).toBe(404);
  });

  it("resolves an issue: sets status and resolvedAt", async () => {
    await seedIssue();
    const res = mockRes();
    await triageIssue(superAdminReq(FP, "resolved"), res);
    expect(res._status).toBe(200);
    const doc = await db.collection(ERROR_ISSUES_COLLECTION).doc(FP).get();
    expect(doc.data()!.status).toBe("resolved");
    expect(typeof doc.data()!.resolvedAt).toBe("string");
  });

  it("ignoring clears resolvedAt", async () => {
    await seedIssue("resolved", new Date().toISOString());
    const res = mockRes();
    await triageIssue(superAdminReq(FP, "ignored"), res);
    const doc = await db.collection(ERROR_ISSUES_COLLECTION).doc(FP).get();
    expect(doc.data()!.status).toBe("ignored");
    expect(doc.data()!.resolvedAt).toBeNull();
  });
});
