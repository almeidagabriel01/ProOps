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
const mockedAxios = axios as jest.Mocked<typeof axios>;

import { createHmac } from "crypto";
import { validateMPSignature, beginMpWebhookProcessing, finalizeMpWebhookProcessing, parseExternalReference, deriveMpFeeFields } from "../mercadopagoWebhook";

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

// ---------------------------------------------------------------------------
// Block D — MPWH-03 fallback failure modes (unit, axios-mocked)
// ---------------------------------------------------------------------------

// NOTE: do NOT add a top-of-file `import { handlePaymentEvent } from "../mercadopagoWebhook"`
// for this describe block. The MPWH-03 tests below use jest.resetModules() + jest.doMock("../init")
// + dynamic require so that the Firestore primary lookup returns an empty snapshot without an
// emulator. A static top-of-file import would bypass the doMock (modules are cached at import time)
// and the primary db.collection(...).where(...).limit(...).get() call would attempt to reach a
// real Firestore client and either crash or hang.

describe("MP webhook — MPWH-03 fallback failure modes (unit, axios-mocked)", () => {
  const ORIGINAL_TOKEN = process.env.MERCADOPAGO_PLATFORM_ACCESS_TOKEN;

  beforeEach(() => {
    // 1) Reset the axios mock state between tests so call counts and queued responses don't leak.
    mockedAxios.get.mockReset();

    // 2) Reset the module registry so the next require("../mercadopagoWebhook") re-resolves
    //    its "./init" import against the freshly-installed doMock below.
    jest.resetModules();

    // 3) Mock the Firestore db so the primary lookup in handlePaymentEvent
    //    (db.collection(PAYMENT_ATTEMPTS_COLLECTION).where(...).limit(1).get()) resolves
    //    to an empty snapshot. This forces every test in this block into the fallback branch
    //    under test, without needing FIRESTORE_EMULATOR_HOST.
    //
    //    The relative path from apps/functions/src/__tests__/ to the init module is "../init".
    //    Confirm by reading the import in mercadopagoWebhook.ts:
    //      import { db } from "./init";
    jest.doMock("../init", () => ({
      db: {
        collection: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn(() => ({
              get: jest.fn(async () => ({ empty: true, docs: [] })),
            })),
          })),
          // .doc() is unused on this code path (fallback bails before the attempt-doc lookup
          // when token is missing, axios throws, or external_reference is malformed), but we
          // stub it defensively so an unintended access surfaces clearly rather than crashing.
          doc: jest.fn(() => ({
            get: jest.fn(async () => ({ exists: false })),
          })),
        })),
      },
    }));
  });

  afterEach(() => {
    // Restore env var so other tests aren't affected.
    if (ORIGINAL_TOKEN === undefined) {
      delete process.env.MERCADOPAGO_PLATFORM_ACCESS_TOKEN;
    } else {
      process.env.MERCADOPAGO_PLATFORM_ACCESS_TOKEN = ORIGINAL_TOKEN;
    }
    // Tear down the per-test module mock so it doesn't leak into Plan 01's emulator-gated Block B
    // tests when run with FIRESTORE_EMULATOR_HOST set.
    jest.dontMock("../init");
    jest.resetModules();
  });

  it("returns without throwing when MERCADOPAGO_PLATFORM_ACCESS_TOKEN is absent AND primary lookup is empty (Behavior 1)", async () => {
    // Arrange: clear the env var; primary lookup is mocked-empty in beforeEach so the fallback
    // branch runs and bails on the missing token.
    delete process.env.MERCADOPAGO_PLATFORM_ACCESS_TOKEN;

    // Dynamic require pulls the freshly-evaluated module with the "../init" doMock in effect.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { handlePaymentEvent } = require("../mercadopagoWebhook");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const loggerWarnSpy = jest.spyOn(require("../lib/logger").logger, "warn");

    // Act + Assert: must NOT throw. New behavior emits the structured "fallback unavailable" warn
    // envelope with lookup_result:"not_found" — asserted below. This test fails against the
    // pre-fix code (which simply logged "no payment attempt found, ignoring" via logger.info and
    // returned, without the new warn envelope or the token check branch).
    await expect(handlePaymentEvent("999")).resolves.toBeUndefined();
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("fallback unavailable"),
      expect.objectContaining({ mpPaymentId: "999", lookup_result: "not_found" }),
    );
    // Axios must NOT have been called when token is absent (fail-closed behavior)
    expect(mockedAxios.get).not.toHaveBeenCalled();
    loggerWarnSpy.mockRestore();
  });

  it("returns without throwing when axios.get throws a network error (Behavior 2)", async () => {
    // Arrange: token present, axios rejects on the fallback call.
    process.env.MERCADOPAGO_PLATFORM_ACCESS_TOKEN = "test-platform-token";

    // Dynamic require pulls the freshly-evaluated module with the "../init" doMock in effect.
    // We also require axios from the same fresh module registry so the mock setup applies to
    // the same axios instance that handlePaymentEvent will use after jest.resetModules().
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const freshAxios = require("axios") as jest.Mocked<typeof import("axios").default>;
    freshAxios.get.mockRejectedValueOnce(new Error("ECONNRESET: connection lost"));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { handlePaymentEvent } = require("../mercadopagoWebhook");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const loggerWarnSpy = jest.spyOn(require("../lib/logger").logger, "warn");

    // Act + Assert: must NOT throw — the fallback's try/catch swallows the axios rejection.
    await expect(handlePaymentEvent("999")).resolves.toBeUndefined();
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("fallback MP API call failed"),
      expect.objectContaining({
        mpPaymentId: "999",
        error: expect.stringContaining("ECONNRESET"),
        lookup_result: "not_found",
      }),
    );
    expect(freshAxios.get).toHaveBeenCalledTimes(1);
    expect(freshAxios.get).toHaveBeenCalledWith(
      expect.stringContaining("/v1/payments/999"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-platform-token" }),
      }),
    );
    loggerWarnSpy.mockRestore();
  });

  it("returns without throwing when MP response has undefined external_reference (Behavior 3)", async () => {
    // Arrange: token present, axios resolves with a response missing external_reference.
    process.env.MERCADOPAGO_PLATFORM_ACCESS_TOKEN = "test-platform-token";

    // Dynamic require from the same fresh module registry as handlePaymentEvent will use.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const freshAxios = require("axios") as jest.Mocked<typeof import("axios").default>;
    freshAxios.get.mockResolvedValueOnce({
      data: {
        id: 999,
        status: "approved",
        transaction_amount: 100,
        // external_reference intentionally omitted to drive parseExternalReference(undefined) → null
      },
    } as never);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { handlePaymentEvent } = require("../mercadopagoWebhook");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const loggerWarnSpy = jest.spyOn(require("../lib/logger").logger, "warn");

    // Act + Assert: must NOT throw. parseExternalReference returns null → fallback logs warn + returns.
    await expect(handlePaymentEvent("999")).resolves.toBeUndefined();
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("external_reference missing or malformed"),
      expect.objectContaining({
        mpPaymentId: "999",
        externalReference: null,
        lookup_result: "not_found",
      }),
    );
    expect(freshAxios.get).toHaveBeenCalledTimes(1);
    loggerWarnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Block E — deriveMpFeeFields (unit)
// ---------------------------------------------------------------------------

describe("MP webhook — deriveMpFeeFields (unit)", () => {
  it("returns gross+net+fee when transaction_details.net_received_amount is positive", () => {
    const result = deriveMpFeeFields({
      id: 1, status: "approved", transaction_amount: 100,
      transaction_details: { net_received_amount: 95 },
    });
    expect(result).toEqual({
      mpGrossAmount: 100, mpNetAmount: 95, mpFeeAmount: 5,
    });
  });

  it("returns only mpGrossAmount when transaction_details is undefined", () => {
    const result = deriveMpFeeFields({
      id: 1, status: "approved", transaction_amount: 100,
    });
    expect(result).toEqual({ mpGrossAmount: 100 });
    expect(result).not.toHaveProperty("mpNetAmount");
    expect(result).not.toHaveProperty("mpFeeAmount");
  });

  it("returns only mpGrossAmount when net_received_amount is 0 (sandbox edge case)", () => {
    const result = deriveMpFeeFields({
      id: 1, status: "approved", transaction_amount: 100,
      transaction_details: { net_received_amount: 0 },
    });
    expect(result).toEqual({ mpGrossAmount: 100 });
    expect(result).not.toHaveProperty("mpNetAmount");
  });

  it("handles non-integer cents correctly (gross=10.50, net=9.97 -> fee=0.53)", () => {
    const result = deriveMpFeeFields({
      id: 1, status: "approved", transaction_amount: 10.50,
      transaction_details: { net_received_amount: 9.97 },
    });
    expect(result.mpGrossAmount).toBe(10.50);
    expect(result.mpNetAmount).toBe(9.97);
    expect(result.mpFeeAmount).toBeCloseTo(0.53, 2);
  });
});
