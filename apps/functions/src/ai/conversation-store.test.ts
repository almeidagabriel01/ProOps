/**
 * Unit tests for conversation-store.ts
 * Focus: ownership validation (uid mismatch) and plan-tier gating.
 */

process.env.NODE_ENV = "test";

jest.mock("../lib/logger", () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// ── Firebase Admin mocks ───────────────────────────────────────────────────────

const mockDocGet = jest.fn();
const mockDocSet = jest.fn();

// Capture snap state so each test can control what the mock returns
let mockSnap: { exists: boolean; data: () => unknown } = {
  exists: false,
  data: () => ({}),
};

mockDocGet.mockImplementation(() => Promise.resolve(mockSnap));
mockDocSet.mockResolvedValue(undefined);

const mockDocRef = { get: mockDocGet, set: mockDocSet };
const mockInnerDoc = jest.fn(() => mockDocRef);
const mockInnerCollection = jest.fn(() => ({ doc: mockInnerDoc }));
const mockOuterDoc = jest.fn(() => ({ collection: mockInnerCollection }));
const mockOuterCollection = jest.fn(() => ({ doc: mockOuterDoc }));

jest.mock("../init", () => ({
  db: { collection: mockOuterCollection },
  auth: {},
  adminApp: {},
}));

jest.mock("firebase-admin/firestore", () => ({
  Timestamp: {
    now: jest.fn(() => ({ seconds: 1_700_000_000, nanoseconds: 0 })),
  },
  FieldValue: { increment: jest.fn() },
}));

import { loadConversation, saveConversation } from "./conversation-store";
import type { AiConversationDocument } from "./ai.types";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeDoc(uid: string, extra: Partial<AiConversationDocument> = {}): AiConversationDocument {
  return {
    sessionId: "sess-1",
    uid,
    tenantId: "tenant-a",
    messages: [],
    createdAt: { seconds: 0, nanoseconds: 0 } as unknown as import("firebase-admin/firestore").Timestamp,
    updatedAt: { seconds: 0, nanoseconds: 0 } as unknown as import("firebase-admin/firestore").Timestamp,
    ...extra,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDocGet.mockImplementation(() => Promise.resolve(mockSnap));
  mockDocSet.mockResolvedValue(undefined);
});

// ── loadConversation ───────────────────────────────────────────────────────────

describe("loadConversation", () => {
  test("returns empty array when document does not exist", async () => {
    mockSnap = { exists: false, data: () => ({}) };
    const result = await loadConversation("tenant-a", "sess-1", "pro", "uid-1");
    expect(result).toEqual([]);
  });

  test("returns messages when uid matches", async () => {
    const messages = [{ role: "user" as const, content: "hello", timestamp: { seconds: 0, nanoseconds: 0 } as unknown as import("firebase-admin/firestore").Timestamp }];
    mockSnap = { exists: true, data: () => makeDoc("uid-1", { messages }) };
    const result = await loadConversation("tenant-a", "sess-1", "pro", "uid-1");
    expect(result).toEqual(messages);
  });

  test("returns empty array when uid does NOT match (ownership violation)", async () => {
    mockSnap = { exists: true, data: () => makeDoc("uid-owner", {}) };
    const result = await loadConversation("tenant-a", "sess-1", "pro", "uid-attacker");
    expect(result).toEqual([]);
  });

  test("returns empty array for starter tier (no persistence)", async () => {
    mockSnap = { exists: true, data: () => makeDoc("uid-1", {}) };
    const result = await loadConversation("tenant-a", "sess-1", "starter", "uid-1");
    expect(result).toEqual([]);
    // Should NOT query Firestore for non-persisted tiers
    expect(mockDocGet).not.toHaveBeenCalled();
  });

  test("returns empty array when sessionId is empty", async () => {
    const result = await loadConversation("tenant-a", "", "pro", "uid-1");
    expect(result).toEqual([]);
    expect(mockDocGet).not.toHaveBeenCalled();
  });
});

// ── saveConversation ───────────────────────────────────────────────────────────

describe("saveConversation", () => {
  test("saves document when uid matches existing session", async () => {
    mockSnap = { exists: true, data: () => makeDoc("uid-1") };
    await saveConversation("tenant-a", "sess-1", "uid-1", [], "pro");
    expect(mockDocSet).toHaveBeenCalledTimes(1);
  });

  test("saves document when session is new (doc does not exist)", async () => {
    mockSnap = { exists: false, data: () => ({}) };
    await saveConversation("tenant-a", "sess-1", "uid-1", [], "pro");
    expect(mockDocSet).toHaveBeenCalledTimes(1);
  });

  test("aborts save when uid does NOT match existing session (ownership violation)", async () => {
    mockSnap = { exists: true, data: () => makeDoc("uid-owner") };
    await saveConversation("tenant-a", "sess-1", "uid-attacker", [], "pro");
    expect(mockDocSet).not.toHaveBeenCalled();
  });

  test("no-op for starter tier (no persistence)", async () => {
    await saveConversation("tenant-a", "sess-1", "uid-1", [], "starter");
    expect(mockDocGet).not.toHaveBeenCalled();
    expect(mockDocSet).not.toHaveBeenCalled();
  });

  test("no-op when sessionId is empty", async () => {
    await saveConversation("tenant-a", "", "uid-1", [], "pro");
    expect(mockDocSet).not.toHaveBeenCalled();
  });

  test("trims messages exceeding MAX_STORED_MESSAGES (20)", async () => {
    mockSnap = { exists: false, data: () => ({}) };
    const ts = { seconds: 0, nanoseconds: 0 } as unknown as import("firebase-admin/firestore").Timestamp;
    const messages = Array.from({ length: 25 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "model") as "user" | "model",
      content: `msg-${i}`,
      timestamp: ts,
    }));
    await saveConversation("tenant-a", "sess-1", "uid-1", messages, "pro");
    const saved = (mockDocSet.mock.calls[0][0] as AiConversationDocument).messages;
    expect(saved.length).toBeLessThanOrEqual(20);
    // Should keep the LAST 20
    expect(saved[saved.length - 1].content).toBe("msg-24");
  });
});
