/**
 * Requires the Firestore emulator on 127.0.0.1:8080.
 * Run via: firebase emulators:exec --only firestore "cd apps/functions && npx jest src/lib/observability/__tests__/error-ingest.service.test.ts"
 */
import { ingestError, ERROR_ISSUES_COLLECTION } from "../error-ingest.service";
import { db } from "../../../init";

const baseInput = {
  errorType: "TypeError",
  message: "user 9f1c2e7a-1b2c-4d5e-8f90-abcdef012345 not found",
  stack: "Error: boom\n    at foo (/srv/a.js:10:5)",
  source: "functions" as const,
  route: "/v1/proposals",
  method: "GET",
  status: 500,
  uid: "uid-1",
  tenantId: "tenant-1",
  userAgent: null,
  why: null,
  fix: null,
  link: null,
};

async function wipe() {
  await db.recursiveDelete(db.collection(ERROR_ISSUES_COLLECTION));
}

describe("ingestError", () => {
  beforeEach(wipe);
  afterAll(wipe);

  it("creates an issue with count 1 on first occurrence", async () => {
    const { fingerprint } = await ingestError(baseInput, { handled: false });
    const doc = await db.collection(ERROR_ISSUES_COLLECTION).doc(fingerprint).get();
    const data = doc.data()!;
    expect(data.count).toBe(1);
    expect(data.status).toBe("unresolved");
    expect(data.severity).toBe("critical");
    expect(data.normalizedMessage).toBe("user <id> not found");
  });

  it("is idempotent-by-grouping: two similar errors increment one issue", async () => {
    const a = await ingestError(baseInput, { handled: false });
    const b = await ingestError(
      { ...baseInput, message: "user 0a2b3c4d-5e6f-7081-9abc-def012345678 not found", uid: "uid-2" },
      { handled: false },
    );
    expect(a.fingerprint).toBe(b.fingerprint);
    const doc = await db.collection(ERROR_ISSUES_COLLECTION).doc(a.fingerprint).get();
    expect(doc.data()!.count).toBe(2);
    expect(doc.data()!.affectedUsers).toBe(2);
  });

  it("reopens a resolved issue on recurrence", async () => {
    const { fingerprint } = await ingestError(baseInput, { handled: false });
    await db.collection(ERROR_ISSUES_COLLECTION).doc(fingerprint).update({
      status: "resolved",
      resolvedAt: new Date().toISOString(),
    });
    await ingestError(baseInput, { handled: false });
    const doc = await db.collection(ERROR_ISSUES_COLLECTION).doc(fingerprint).get();
    expect(doc.data()!.status).toBe("unresolved");
    expect(doc.data()!.resolvedAt).toBeNull();
  });

  it("caps the occurrence sample subcollection", async () => {
    for (let i = 0; i < 55; i++) {
      await ingestError({ ...baseInput, uid: `uid-${i}` }, { handled: false });
    }
    const { fingerprint } = await ingestError(baseInput, { handled: false });
    const occ = await db
      .collection(ERROR_ISSUES_COLLECTION)
      .doc(fingerprint)
      .collection("occurrences")
      .get();
    expect(occ.size).toBeLessThanOrEqual(50);
  });

  it("never downgrades severity on recurrence (max-severity-ever)", async () => {
    // Use a distinct route to get a fresh fingerprint unaffected by the rate guard
    // state accumulated by earlier tests (the guard is a module-level singleton).
    const severityInput = { ...baseInput, route: "/v1/severity-test" };
    const { fingerprint } = await ingestError(severityInput, { handled: false }); // status 500 -> critical
    // Same fingerprint (fingerprint ignores status/handled), now a handled 4xx -> warning.
    await ingestError({ ...severityInput, status: 400 }, { handled: true });
    const doc = await db.collection(ERROR_ISSUES_COLLECTION).doc(fingerprint).get();
    expect(doc.data()!.severity).toBe("critical");
    expect(doc.data()!.count).toBe(2);
  });

  it("never throws even if the input is degenerate", async () => {
    await expect(
      ingestError(
        { ...baseInput, message: "", stack: null, route: null, method: null, status: null, uid: null, tenantId: null },
        { handled: true },
      ),
    ).resolves.toHaveProperty("fingerprint");
  });
});
