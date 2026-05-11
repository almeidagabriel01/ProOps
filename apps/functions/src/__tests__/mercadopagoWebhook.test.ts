/**
 * MPWH-01 + MPWH-02 — MercadoPago webhook: HMAC validation + idempotency gate.
 *
 * Block A (unit): HMAC manifest format — no Firestore, no emulator.
 * Block B (integration): idempotency lifecycle — requires Firestore emulator.
 *   Skipped automatically when FIRESTORE_EMULATOR_HOST is unset.
 *
 * jest.mock("axios") is scaffolding for Plan 02 Task 2 tests that mock the
 * MP payment-status API call. It is harmless in Plan 01 (no axios calls here).
 */

// jest.mock must be hoisted above imports. ts-jest hoists automatically.
jest.mock("axios");
import axios from "axios";
// Scaffolding for Plan 02 Task 2. Reference suppresses noUnusedLocals.
const mockedAxios = axios as jest.Mocked<typeof axios>;
void mockedAxios; // Plan 02 Task 2 will replace this with real usage

import { createHmac } from "crypto";
import { validateMPSignature, beginMpWebhookProcessing, finalizeMpWebhookProcessing, parseExternalReference } from "../mercadopagoWebhook";

// ---------------------------------------------------------------------------
// Block A — HMAC manifest format (unit)
// ---------------------------------------------------------------------------

describe("MP webhook — HMAC manifest format (unit)", () => {
  const TEST_SECRET = "test-secret-mpwh";
  const DATA_ID = "99999";
  const X_REQUEST_ID = "abc-123";
  const TS = "1700000000";

  beforeAll(() => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = TEST_SECRET;
  });

  afterAll(() => {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
  });

  function buildXSignature(secret: string, manifest: string, ts: string): string {
    const hmac = createHmac("sha256", secret).update(manifest).digest("hex");
    return `ts=${ts},v1=${hmac}`;
  }

  function buildRequest(xSignature: string, xRequestId: string) {
    return {
      headers: {
        "x-signature": xSignature,
        "x-request-id": xRequestId,
      } as Record<string, string | string[] | undefined>,
    };
  }

  it("returns true for a signature computed over the correct manifest format id:<dataId>;request-id:<xRequestId>;ts:<ts>;", () => {
    const manifest = `id:${DATA_ID};request-id:${X_REQUEST_ID};ts:${TS};`;
    const xSignature = buildXSignature(TEST_SECRET, manifest, TS);
    const req = buildRequest(xSignature, X_REQUEST_ID);
    const body = { data: { id: DATA_ID } };
    expect(validateMPSignature(req, body)).toBe(true);
  });

  it("returns false for a signature computed over the OLD broken manifest format <xRequestId>;<dataId>;<ts>", () => {
    // Verify that the legacy broken manifest is rejected after the fix.
    const brokenManifest = `${X_REQUEST_ID};${DATA_ID};${TS}`;
    const xSignature = buildXSignature(TEST_SECRET, brokenManifest, TS);
    const req = buildRequest(xSignature, X_REQUEST_ID);
    const body = { data: { id: DATA_ID } };
    // The implementation now uses the correct format, so the broken-manifest HMAC must NOT match.
    expect(validateMPSignature(req, body)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Block B — idempotency gate + structured entry log (integration)
// ---------------------------------------------------------------------------

const RUN_INTEGRATION = !!process.env.FIRESTORE_EMULATOR_HOST;
const itIfEmulator = RUN_INTEGRATION ? it : it.skip;

describe("MP webhook — idempotency gate + structured entry log (integration)", () => {
  itIfEmulator(
    "first delivery: writes webhookEvents/{xRequestId} with status='processing' inside a transaction",
    async () => {
      const { db } = await import("../init");
      const xRequestId = `mpwh_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const body = { action: "payment.created", data: { id: "54321" } };

      const result = await beginMpWebhookProcessing(xRequestId, body);
      expect(result).toBe("process");

      const snap = await db.collection("webhookEvents").doc(xRequestId).get();
      expect(snap.exists).toBe(true);
      const data = snap.data() as Record<string, unknown>;
      expect(data.status).toBe("processing");
      expect(data.action).toBe(body.action);
      expect(data.dataId).toBe(body.data.id);
      expect(data.receivedAt).toBeTruthy(); // Firestore Timestamp

      // Cleanup
      await db.collection("webhookEvents").doc(xRequestId).delete();
    },
    15_000,
  );

  itIfEmulator(
    "duplicate delivery (same xRequestId, status=done): returns 'skip', does not mutate doc",
    async () => {
      const { db } = await import("../init");
      const xRequestId = `mpwh_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const body = { action: "payment.updated", data: { id: "99888" } };

      // Pre-write a finished event
      await db.collection("webhookEvents").doc(xRequestId).set({
        action: body.action,
        dataId: body.data?.id,
        status: "done",
        lastProcessedAt: new Date().toISOString(),
      });

      const result = await beginMpWebhookProcessing(xRequestId, body);
      expect(result).toBe("skip");

      // Doc must remain status:"done" — not mutated
      const snap = await db.collection("webhookEvents").doc(xRequestId).get();
      expect((snap.data() as Record<string, unknown>).status).toBe("done");

      // Cleanup
      await db.collection("webhookEvents").doc(xRequestId).delete();
    },
    15_000,
  );

  itIfEmulator(
    "failed lifecycle: when handler throws after gate, status updates to 'failed' (test via finalizeMpWebhookProcessing helper)",
    async () => {
      const { db } = await import("../init");
      const xRequestId = `mpwh_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const body = { action: "payment.created", data: { id: "11111" } };

      // First: claim the event
      await beginMpWebhookProcessing(xRequestId, body);

      // Simulate unexpected error after gate
      await finalizeMpWebhookProcessing(xRequestId, "failed", "synthetic error");

      const snap = await db.collection("webhookEvents").doc(xRequestId).get();
      const data = snap.data() as Record<string, unknown>;
      expect(data.status).toBe("failed");
      expect(data.lastError).toBe("synthetic error");

      // Cleanup
      await db.collection("webhookEvents").doc(xRequestId).delete();
    },
    15_000,
  );
});

// ---------------------------------------------------------------------------
// Block C — parseExternalReference (unit)
// ---------------------------------------------------------------------------

describe("MP webhook — parseExternalReference (unit)", () => {
  it("returns { transactionId, attemptId } for canonical format 'tx123:att456'", () => {
    expect(parseExternalReference("tx123:att456")).toEqual({
      transactionId: "tx123",
      attemptId: "att456",
    });
  });

  it("returns null when ref is undefined, null, or empty string", () => {
    expect(parseExternalReference(undefined)).toBeNull();
    expect(parseExternalReference(null)).toBeNull();
    expect(parseExternalReference("")).toBeNull();
  });

  it("returns null when ref has no colon (malformed)", () => {
    expect(parseExternalReference("no-colon-here")).toBeNull();
  });

  it("returns null when ref has more than one colon", () => {
    expect(parseExternalReference("a:b:c")).toBeNull();
  });

  it("returns null when either segment is empty after trim", () => {
    expect(parseExternalReference(":att456")).toBeNull();
    expect(parseExternalReference("tx123:")).toBeNull();
    expect(parseExternalReference("  :  ")).toBeNull();
  });
});
