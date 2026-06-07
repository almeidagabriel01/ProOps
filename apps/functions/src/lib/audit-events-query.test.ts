jest.mock("./logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { fetchAuditEvents, type AuditQuerySource } from "./audit-events-query";
import { logger } from "./logger";

interface Doc {
  id: string;
  tenantId?: string;
  uid?: string;
  eventType?: string;
}

function makeSource(docs: Doc[], opts: { failIndexed?: boolean } = {}) {
  const whereCalls: Array<[string, string, string]> = [];

  function makeQuery(hasWhere: boolean): AuditQuerySource {
    return {
      where(field, op, value) {
        whereCalls.push([field, op, value]);
        return makeQuery(true);
      },
      orderBy() {
        return makeQuery(hasWhere);
      },
      limit() {
        return makeQuery(hasWhere);
      },
      async get() {
        if (hasWhere && opts.failIndexed) {
          throw new Error("FAILED_PRECONDITION: index is building");
        }
        return {
          docs: docs.map((d) => ({ id: d.id, data: () => ({ ...d }) })),
        };
      },
    };
  }

  return { source: makeQuery(false), whereCalls };
}

const DOCS: Doc[] = [
  { id: "1", tenantId: "tenant-A", uid: "u1", eventType: "login" },
  { id: "2", tenantId: "tenant-B", uid: "u2", eventType: "login" },
  { id: "3", tenantId: "tenant-A", uid: "u3", eventType: "denial" },
];

beforeEach(() => jest.clearAllMocks());

describe("fetchAuditEvents — tenant filter at DB level", () => {
  it("filters tenantId at the DATABASE (calls .where) when tenantId is provided", async () => {
    const { source, whereCalls } = makeSource(DOCS);
    const events = await fetchAuditEvents(source, { tenantId: "tenant-A", limit: 50 });

    expect(whereCalls).toContainEqual(["tenantId", "==", "tenant-A"]);
    // (mock returns all docs; the in-memory belt still scopes to tenant-A)
    expect(events.every((e) => e.tenantId === "tenant-A")).toBe(true);
    expect(events).toHaveLength(2);
  });

  it("does NOT call .where when no tenantId (global super-admin view)", async () => {
    const { source, whereCalls } = makeSource(DOCS);
    const events = await fetchAuditEvents(source, { limit: 50 });

    expect(whereCalls).toHaveLength(0);
    expect(events).toHaveLength(3);
  });

  it("falls back to global window + in-memory filter when the index is still building", async () => {
    const { source, whereCalls } = makeSource(DOCS, { failIndexed: true });
    const events = await fetchAuditEvents(source, { tenantId: "tenant-A", limit: 50 });

    expect(whereCalls).toContainEqual(["tenantId", "==", "tenant-A"]); // attempted
    expect(logger.warn).toHaveBeenCalled();
    // fallback still returns the correct tenant-scoped result
    expect(events.every((e) => e.tenantId === "tenant-A")).toBe(true);
    expect(events).toHaveLength(2);
  });

  it("applies uid and eventType as in-memory filters", async () => {
    const { source } = makeSource(DOCS);
    const byUid = await fetchAuditEvents(source, { uid: "u3", limit: 50 });
    expect(byUid).toHaveLength(1);
    expect(byUid[0].id).toBe("3");

    const byType = await fetchAuditEvents(source, { eventType: "login", limit: 50 });
    expect(byType).toHaveLength(2);
  });

  it("respects the limit", async () => {
    const { source } = makeSource(DOCS);
    const events = await fetchAuditEvents(source, { limit: 1 });
    expect(events).toHaveLength(1);
  });
});
