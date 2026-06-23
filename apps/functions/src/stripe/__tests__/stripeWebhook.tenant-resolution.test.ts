/**
 * Regression: a Stripe event whose tenant cannot be resolved deterministically
 * (orphaned/test subscription — tenant deleted or test data) must NOT return 500.
 *
 * Before the fix: resolveTenantIdForBillingEvent throws TENANT_RESOLUTION_FAILED
 * → inner catch logs webhook_failed + captureError + rethrow → 500 → Stripe
 * retries in a loop for ~3 days and the error is captured twice (inner + outer).
 *
 * After the fix: deterministic resolution failures ACK with 200 {skipped} so the
 * retry-storm stops; genuine (transient) errors still return 500 so Stripe retries.
 */

// onRequest just returns the raw handler so we can call it like a function.
jest.mock("firebase-functions/v2/https", () => ({
  onRequest: (_opts: unknown, handler: unknown) => handler,
}));

jest.mock("firebase-admin/firestore", () => ({
  Timestamp: { fromMillis: () => ({}), now: () => ({}) },
  FieldValue: { increment: () => ({}), serverTimestamp: () => ({}), arrayUnion: () => ({}) },
}));

jest.mock("../../lib/secret-rotation-guard", () => ({
  runSecretRotationGuard: jest.fn(),
}));

jest.mock("../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockCaptureError = jest.fn();
jest.mock("../../lib/observability/error-logger", () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
}));

const mockLogSecurityEvent = jest.fn();
const mockIncrementSecurityCounter = jest.fn();
const mockWriteSecurityAuditEvent = jest.fn();
jest.mock("../../lib/security-observability", () => ({
  attachRequestId: jest.fn(() => "req-1"),
  buildSecurityLogContext: jest.fn(() => ({})),
  incrementSecurityCounter: (...args: unknown[]) => mockIncrementSecurityCounter(...args),
  logSecurityEvent: (...args: unknown[]) => mockLogSecurityEvent(...args),
  writeSecurityAuditEvent: (...args: unknown[]) => mockWriteSecurityAuditEvent(...args),
}));

const mockConstructEvent = jest.fn();
jest.mock("../stripeConfig", () => ({
  getStripe: () => ({ webhooks: { constructEvent: mockConstructEvent } }),
  getWebhookSecret: () => "whsec_test",
}));

// Build a configurable Firestore mock. Tenant lookups drive resolution outcome.
let tenantDocs: Array<{ id: string; data: () => Record<string, unknown> }> = [];
let tenantsGetRejects = false;

function makeQuery(docs: Array<{ id: string; data: () => Record<string, unknown> }>, rejects = false) {
  const q: Record<string, unknown> = {};
  q.where = jest.fn(() => q);
  q.limit = jest.fn(() => q);
  q.get = jest.fn(async () => {
    if (rejects) throw new Error("firestore unavailable");
    return { docs };
  });
  return q;
}

jest.mock("../../init", () => ({
  db: {
    runTransaction: jest.fn(async (fn: (tx: unknown) => unknown) =>
      fn({
        get: jest.fn(async () => ({ exists: false, data: () => undefined })),
        set: jest.fn(),
      }),
    ),
    collection: jest.fn((name: string) => {
      if (name === "stripe_events") {
        return {
          doc: jest.fn(() => ({
            set: jest.fn().mockResolvedValue(undefined),
            get: jest.fn().mockResolvedValue({ exists: false, data: () => undefined }),
          })),
          where: jest.fn(() => makeQuery([])),
        };
      }
      if (name === "tenants") return makeQuery(tenantDocs, tenantsGetRejects);
      return makeQuery([]);
    }),
  },
}));

import { stripeWebhook } from "../stripeWebhook";

type Handler = (req: unknown, res: unknown) => Promise<void>;
const handler = stripeWebhook as unknown as Handler;

function makeRes() {
  const res: Record<string, jest.Mock> = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  return res;
}

function makeReq() {
  return {
    method: "POST",
    path: "/stripeWebhook",
    headers: { "stripe-signature": "sig" },
    rawBody: Buffer.from("{}"),
    ip: "1.2.3.4",
  };
}

function makeSubscriptionEvent(metadataTenantId?: string) {
  return {
    id: "evt_1",
    type: "customer.subscription.updated",
    livemode: false,
    data: {
      object: {
        id: "sub_1",
        customer: null,
        metadata: metadataTenantId ? { tenantId: metadataTenantId } : {},
      },
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  tenantDocs = [];
  tenantsGetRejects = false;
});

describe("stripeWebhook deterministic tenant-resolution failures", () => {
  it("ACKs 200 (skipped) when no tenant resolves (TENANT_RESOLUTION_FAILED)", async () => {
    tenantDocs = [];
    mockConstructEvent.mockReturnValue(makeSubscriptionEvent());
    const res = makeRes();

    await handler(makeReq(), res);

    expect(res.json).toHaveBeenCalledWith({
      received: true,
      skipped: "TENANT_RESOLUTION_FAILED",
    });
    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(mockCaptureError).not.toHaveBeenCalled();
    expect(mockLogSecurityEvent).toHaveBeenCalledWith(
      "stripe_webhook_skipped",
      expect.objectContaining({ status: 200, reason: "TENANT_RESOLUTION_FAILED" }),
      "WARN",
    );
  });

  it("ACKs 200 (skipped) when multiple tenants match (TENANT_RESOLUTION_AMBIGUOUS)", async () => {
    tenantDocs = [
      { id: "t1", data: () => ({}) },
      { id: "t2", data: () => ({}) },
    ];
    mockConstructEvent.mockReturnValue(makeSubscriptionEvent());
    const res = makeRes();

    await handler(makeReq(), res);

    expect(res.json).toHaveBeenCalledWith({
      received: true,
      skipped: "TENANT_RESOLUTION_AMBIGUOUS",
    });
    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(mockCaptureError).not.toHaveBeenCalled();
  });

  it("ACKs 200 (skipped) when metadata tenant disagrees (TENANT_METADATA_MISMATCH)", async () => {
    tenantDocs = [{ id: "t1", data: () => ({}) }];
    mockConstructEvent.mockReturnValue(makeSubscriptionEvent("t-other"));
    const res = makeRes();

    await handler(makeReq(), res);

    expect(res.json).toHaveBeenCalledWith({
      received: true,
      skipped: "TENANT_METADATA_MISMATCH",
    });
    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(mockCaptureError).not.toHaveBeenCalled();
  });

  it("returns 500 and captures a genuine (transient) error so Stripe retries", async () => {
    tenantsGetRejects = true; // Firestore read fails — not a deterministic skip
    mockConstructEvent.mockReturnValue(makeSubscriptionEvent());
    const res = makeRes();

    await handler(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(mockCaptureError).toHaveBeenCalledTimes(1);
    expect(mockLogSecurityEvent).toHaveBeenCalledWith(
      "webhook_failed",
      expect.objectContaining({ status: 500 }),
      "ERROR",
    );
  });
});
