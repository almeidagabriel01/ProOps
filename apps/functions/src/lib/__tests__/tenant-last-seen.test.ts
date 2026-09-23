/**
 * Ultima vez online da empresa: janela de gravacao e quem NAO conta.
 */

const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
let updateError: unknown = null;

jest.mock("../../init", () => ({
  db: {
    collection: () => ({
      doc: (id: string) => ({
        update: async (data: Record<string, unknown>) => {
          if (updateError) throw updateError;
          updates.push({ id, data });
        },
      }),
    }),
  },
}));
const warn = jest.fn();
jest.mock("../logger", () => ({ logger: { warn: (...a: unknown[]) => warn(...(a as [])), info: jest.fn(), error: jest.fn() } }));

import {
  LAST_SEEN_WINDOW_MS,
  clearLastSeenCacheForTest,
  countsAsTenantAccess,
  recordTenantLastSeen,
  shouldRecordLastSeen,
} from "../tenant-last-seen";

const T0 = Date.parse("2026-09-23T10:00:00.000Z");

beforeEach(() => {
  updates.length = 0;
  updateError = null;
  warn.mockClear();
  clearLastSeenCacheForTest();
});

describe("shouldRecordLastSeen", () => {
  it("primeira vez sempre grava", () => {
    expect(shouldRecordLastSeen(undefined, T0)).toBe(true);
  });

  it("dentro da janela nao grava de novo", () => {
    expect(shouldRecordLastSeen(T0, T0 + LAST_SEEN_WINDOW_MS - 1)).toBe(false);
  });

  it("no limite da janela grava", () => {
    expect(shouldRecordLastSeen(T0, T0 + LAST_SEEN_WINDOW_MS)).toBe(true);
  });
});

describe("countsAsTenantAccess", () => {
  it("super admin nao conta como acesso da empresa", () => {
    expect(countsAsTenantAccess({ tenantId: "t1", role: "SUPERADMIN" })).toBe(false);
    expect(countsAsTenantAccess({ tenantId: "t1", role: "superadmin" })).toBe(false);
  });

  it("conta gratuita conta: e o caso de quem criou e nao assinou", () => {
    expect(countsAsTenantAccess({ tenantId: "t1", role: "free" })).toBe(true);
  });

  it("master, admin e membro contam", () => {
    for (const role of ["MASTER", "ADMIN", "MEMBER", "WK"]) {
      expect(countsAsTenantAccess({ tenantId: "t1", role })).toBe(true);
    }
  });

  it("sem empresa resolvida nao conta", () => {
    expect(countsAsTenantAccess({ tenantId: "", role: "MASTER" })).toBe(false);
    expect(countsAsTenantAccess({ tenantId: null, role: "MASTER" })).toBe(false);
  });
});

describe("recordTenantLastSeen", () => {
  it("grava a hora do acesso e segura as repeticoes dentro da janela", async () => {
    await recordTenantLastSeen({ tenantId: "t1", role: "MASTER", nowMs: T0 });
    await recordTenantLastSeen({ tenantId: "t1", role: "MASTER", nowMs: T0 + 60_000 });
    expect(updates).toEqual([
      { id: "t1", data: { lastSeenAt: "2026-09-23T10:00:00.000Z" } },
    ]);

    await recordTenantLastSeen({
      tenantId: "t1",
      role: "MASTER",
      nowMs: T0 + LAST_SEEN_WINDOW_MS,
    });
    expect(updates).toHaveLength(2);
    expect(updates[1].data).toEqual({ lastSeenAt: "2026-09-23T10:15:00.000Z" });
  });

  it("empresas diferentes tem janelas independentes", async () => {
    await recordTenantLastSeen({ tenantId: "t1", role: "MASTER", nowMs: T0 });
    await recordTenantLastSeen({ tenantId: "t2", role: "MASTER", nowMs: T0 });
    expect(updates.map((u) => u.id)).toEqual(["t1", "t2"]);
  });

  it("super admin nao marca a empresa como online", async () => {
    await recordTenantLastSeen({ tenantId: "t1", role: "SUPERADMIN", nowMs: T0 });
    expect(updates).toHaveLength(0);
  });

  it("tenant legado sem documento nao e criado pelo heartbeat", async () => {
    updateError = Object.assign(new Error("no document"), { code: 5 });
    await recordTenantLastSeen({ tenantId: "t1", role: "MASTER", nowMs: T0 });
    expect(updates).toHaveLength(0);
    expect(warn).not.toHaveBeenCalled();
  });

  it("outra falha e registrada, sem derrubar a request", async () => {
    updateError = new Error("indisponivel");
    await expect(
      recordTenantLastSeen({ tenantId: "t1", role: "MASTER", nowMs: T0 }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });
});
