/**
 * Ultima vez online da empresa: quem conta como acesso, e a janela
 * ANTIRREPETICAO (que protege de laco de recarga, nao define precisao).
 */

const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
let updateError: unknown = null;

const collections: string[] = [];

jest.mock("../../init", () => ({
  db: {
    collection: (name: string) => ({
      doc: (id: string) => ({
        set: async (data: Record<string, unknown>) => {
          collections.push(name);
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
  LAST_SEEN_DEDUPE_MS,
  clearLastSeenCacheForTest,
  countsAsTenantAccess,
  pickLastSeen,
  recordTenantLastSeen,
  shouldRecordLastSeen,
} from "../tenant-last-seen";

const T0 = Date.parse("2026-09-23T10:00:00.000Z");

beforeEach(() => {
  updates.length = 0;
  collections.length = 0;
  updateError = null;
  warn.mockClear();
  clearLastSeenCacheForTest();
});

describe("shouldRecordLastSeen", () => {
  it("primeira vez sempre grava", () => {
    expect(shouldRecordLastSeen(undefined, T0)).toBe(true);
  });

  it("aviso repetido no mesmo minuto nao vira segunda escrita", () => {
    expect(shouldRecordLastSeen(T0, T0 + LAST_SEEN_DEDUPE_MS - 1)).toBe(false);
  });

  it("a janela e curta: um minuto depois ja grava de novo", () => {
    expect(LAST_SEEN_DEDUPE_MS).toBe(60_000);
    expect(shouldRecordLastSeen(T0, T0 + LAST_SEEN_DEDUPE_MS)).toBe(true);
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
  it("grava a hora do acesso e ignora a repeticao imediata", async () => {
    await recordTenantLastSeen({ tenantId: "t1", role: "MASTER", nowMs: T0 });
    await recordTenantLastSeen({ tenantId: "t1", role: "MASTER", nowMs: T0 + 5_000 });
    expect(updates).toEqual([
      { id: "t1", data: { tenantId: "t1", lastSeenAt: "2026-09-23T10:00:00.000Z" } },
    ]);

    // Voltar meia hora depois e um acesso de verdade: grava a hora NOVA, e nao
    // a antiga. Era exatamente isto que a versao por janela de 15 min perdia.
    await recordTenantLastSeen({
      tenantId: "t1",
      role: "MASTER",
      nowMs: T0 + 30 * 60_000,
    });
    expect(updates).toHaveLength(2);
    expect(updates[1].data).toEqual({ tenantId: "t1", lastSeenAt: "2026-09-23T10:30:00.000Z" });
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

  it("grava na colecao propria, nunca no doc tenants/{id}", async () => {
    // O doc da empresa e escutado em tempo real por toda aba aberta dela:
    // gravar ali fazia cada registro re-renderizar a tela e rebuscar add-ons.
    await recordTenantLastSeen({ tenantId: "t1", role: "MASTER", nowMs: T0 });
    expect(collections).toEqual(["tenant_presence"]);
  });

  it("outra falha e registrada, sem derrubar a request", async () => {
    updateError = new Error("indisponivel");
    await expect(
      recordTenantLastSeen({ tenantId: "t1", role: "MASTER", nowMs: T0 }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });
});

describe("pickLastSeen", () => {
  it("vale o mais recente entre a colecao nova e o campo legado", () => {
    expect(pickLastSeen("2026-09-23T10:00:00.000Z", "2026-09-22T10:00:00.000Z")).toBe(
      "2026-09-23T10:00:00.000Z",
    );
    expect(pickLastSeen("2026-09-21T10:00:00.000Z", "2026-09-22T10:00:00.000Z")).toBe(
      "2026-09-22T10:00:00.000Z",
    );
  });

  it("so o legado (gravado na primeira versao) nao se perde", () => {
    expect(pickLastSeen(undefined, "2026-09-22T10:00:00.000Z")).toBe("2026-09-22T10:00:00.000Z");
  });

  it("nada valido vira undefined", () => {
    expect(pickLastSeen(undefined, undefined)).toBeUndefined();
    expect(pickLastSeen("lixo", "")).toBeUndefined();
  });
});
