/**
 * Unit tests for updateProfile `preferences` validation.
 * Mocks init (db/auth) and side-effect deps. Asserts: valid boolean persists
 * via dot-path merge; non-boolean, unknown keys and non-object payloads are
 * rejected with 400 without touching Firestore; updates without preferences
 * keep working.
 */

const mockUpdate = jest.fn();
const mockGet = jest.fn();

jest.mock("../../../init", () => ({
  auth: { updateUser: jest.fn() },
  db: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({ get: mockGet, update: mockUpdate })),
    })),
    runTransaction: jest.fn(),
  },
}));

jest.mock("../admin.controller", () => ({
  upsertPhoneNumberIndexTx: jest.fn(),
  normalizePhoneNumber: (v: string) => v,
}));

jest.mock("../../../lib/contact-validation", () => ({
  validateBrazilMobilePhone: jest.fn(() => ({ valid: true })),
}));

jest.mock("../../../lib/whatsapp-eligibility", () => ({
  maybeAutoEnableWhatsApp: jest.fn(async () => undefined),
}));

jest.mock("../../../lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { updateProfile } from "../users.controller";

function makeRes() {
  const res: Record<string, unknown> = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res as { status: jest.Mock; json: jest.Mock };
}

function makeReq(body: Record<string, unknown>) {
  return {
    user: { uid: "user-1" },
    body,
  } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue({
    exists: true,
    data: () => ({ name: "Gabriel", tenantId: "t1" }),
  });
});

describe("updateProfile preferences", () => {
  it("persists liaSoundsEnabled=false via dot-path", async () => {
    const res = makeRes();
    await updateProfile(makeReq({ preferences: { liaSoundsEnabled: false } }), res as never);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ "preferences.liaSoundsEnabled": false }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });

  it("persists liaSoundsEnabled=true via dot-path", async () => {
    const res = makeRes();
    await updateProfile(makeReq({ preferences: { liaSoundsEnabled: true } }), res as never);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ "preferences.liaSoundsEnabled": true }),
    );
  });

  it("rejects non-boolean value with 400 and does not write", async () => {
    const res = makeRes();
    await updateProfile(makeReq({ preferences: { liaSoundsEnabled: "yes" } }), res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects unknown preference keys with 400", async () => {
    const res = makeRes();
    await updateProfile(makeReq({ preferences: { theme: "dark" } }), res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects non-object preferences (array) with 400", async () => {
    const res = makeRes();
    await updateProfile(makeReq({ preferences: [true] }), res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects non-object preferences (string) with 400", async () => {
    const res = makeRes();
    await updateProfile(makeReq({ preferences: "on" }), res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("update without preferences keeps working and writes no preference path", async () => {
    const res = makeRes();
    await updateProfile(makeReq({ name: "Novo Nome" }), res as never);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
    const written = mockUpdate.mock.calls[0][0];
    expect(written).toEqual(expect.objectContaining({ name: "Novo Nome" }));
    expect(Object.keys(written)).not.toContain("preferences.liaSoundsEnabled");
  });
});
