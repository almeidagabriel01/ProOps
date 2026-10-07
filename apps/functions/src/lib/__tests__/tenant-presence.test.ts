/**
 * "Online agora" do painel do super admin: quem entrou às 10h15 e continua
 * usando, quem está com a aba aberta sem mexer e quem entrou, olhou algo e
 * saiu, com a sessão encerrada indo para a atividade da empresa.
 */

type Data = Record<string, unknown>;
const store: Record<string, Record<string, Data>> = {};

interface Snap {
  id: string;
  exists: boolean;
  ref: DocRef;
  data: () => Data | undefined;
  get: (field: string) => unknown;
}
interface DocRef {
  id: string;
  path: string;
  get: () => Promise<Snap>;
  set: (data: Data, opts?: { merge?: boolean }) => Promise<void>;
  update: (patch: Data) => Promise<void>;
  collection: (sub: string) => CollectionRef;
}
interface QueryRef {
  where: (field: string, op: string, value: unknown) => QueryRef;
  orderBy: (field: string) => QueryRef;
  limit: (n: number) => QueryRef;
  get: () => Promise<{ docs: Snap[] }>;
}
interface CollectionRef extends QueryRef {
  doc: (id: string) => DocRef;
}

function docRef(path: string, id: string): DocRef {
  const col = () => (store[path] ??= {});
  return {
    id,
    path: `${path}/${id}`,
    get: async () => {
      const data = col()[id];
      return {
        id,
        exists: data !== undefined,
        ref: docRef(path, id),
        data: () => (data ? { ...data } : undefined),
        get: (field: string) => data?.[field],
      };
    },
    set: async (data, opts) => {
      col()[id] = opts?.merge ? { ...(col()[id] ?? {}), ...data } : { ...data };
    },
    update: async (patch) => {
      col()[id] = { ...(col()[id] ?? {}), ...patch };
    },
    collection: (sub) => collectionRef(`${path}/${id}/${sub}`),
  };
}

type Filter = { field: string; op: string; value: unknown };
function queryRef(path: string, filters: Filter[], order?: string, max?: number): QueryRef {
  return {
    where: (field, op, value) => queryRef(path, [...filters, { field, op, value }], order, max),
    orderBy: (field) => queryRef(path, filters, field, max),
    limit: (n) => queryRef(path, filters, order, n),
    get: async () => {
      let entries = Object.entries(store[path] ?? {}).filter(([, data]) =>
        filters.every((f) =>
          f.op === "==" ? data[f.field] === f.value : String(data[f.field] ?? "") >= String(f.value),
        ),
      );
      if (order) entries = entries.sort((a, b) => String(b[1][order]).localeCompare(String(a[1][order])));
      entries = entries.slice(0, max ?? Infinity);
      return { docs: await Promise.all(entries.map(([id]) => docRef(path, id).get())) };
    },
  };
}

function collectionRef(path: string): CollectionRef {
  return { ...queryRef(path, []), doc: (id: string) => docRef(path, id) };
}

const fakeDb = {
  collection: (name: string) => collectionRef(name),
  runTransaction: async <T>(fn: (tx: unknown) => Promise<T>) =>
    fn({
      get: (ref: DocRef) => ref.get(),
      getAll: (...refs: DocRef[]) => Promise.all(refs.map((r) => r.get())),
      set: (ref: DocRef, data: Data, opts?: { merge?: boolean }) => void ref.set(data, opts),
      update: (ref: DocRef, data: Data) => void ref.update(data),
    }),
};

const recordTenantActivity = jest.fn().mockResolvedValue(undefined);

jest.mock("../../init", () => ({ db: fakeDb }));
jest.mock("../logger", () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }));
jest.mock("../tenant-activity", () => ({
  recordTenantActivity: (input: unknown) => recordTenantActivity(input),
}));

import {
  applyHeartbeat,
  clearPresenceCachesForTest,
  closeStaleSessions,
  listTenantPresence,
  presenceStatus,
  recordHeartbeat,
  sessionDurationMinutes,
  shouldWriteHeartbeat,
  summarizeTenantPresence,
} from "../tenant-presence";

const MIN = 60 * 1000;
const T0 = Date.parse("2026-10-07T13:15:00.000Z"); // 10:15 em Brasília
const iso = (ms: number) => new Date(ms).toISOString();

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  clearPresenceCachesForTest();
  recordTenantActivity.mockClear();
});

describe("presenceStatus", () => {
  it("online com aviso de uso recente", () => {
    expect(presenceStatus({ lastHeartbeatAt: iso(T0), lastActiveAt: iso(T0) }, T0 + 1 * MIN)).toBe("online");
  });

  it("ausente: aba aberta e avisando, mas sem uso", () => {
    expect(
      presenceStatus({ lastHeartbeatAt: iso(T0 + 10 * MIN), lastActiveAt: iso(T0) }, T0 + 10 * MIN),
    ).toBe("away");
    expect(presenceStatus({ lastHeartbeatAt: iso(T0), lastActiveAt: null }, T0)).toBe("away");
  });

  it("offline quando os avisos param por mais de 3 minutos", () => {
    expect(presenceStatus({ lastHeartbeatAt: iso(T0), lastActiveAt: iso(T0) }, T0 + 3 * MIN + 1)).toBe("offline");
    expect(presenceStatus({}, T0)).toBe("offline");
  });
});

describe("applyHeartbeat", () => {
  it("primeiro aviso abre a sessão", () => {
    const { next, closed } = applyHeartbeat(null, T0, true);
    expect(next).toEqual({ sessionStartedAt: iso(T0), lastHeartbeatAt: iso(T0), lastActiveAt: iso(T0), open: true });
    expect(closed).toBeNull();
  });

  it("aviso dentro da janela continua a sessão de 10:15", () => {
    const first = applyHeartbeat(null, T0, true).next;
    const { next, closed } = applyHeartbeat(first, T0 + 2 * MIN, false);
    expect(next.sessionStartedAt).toBe(iso(T0));
    expect(next.lastHeartbeatAt).toBe(iso(T0 + 2 * MIN));
    expect(next.lastActiveAt).toBe(iso(T0));
    expect(closed).toBeNull();
  });

  it("depois de um intervalo, a sessão anterior fecha no último aviso e outra começa", () => {
    const first = { ...applyHeartbeat(null, T0, true).next, lastHeartbeatAt: iso(T0 + 5 * MIN) };
    const { next, closed } = applyHeartbeat(first, T0 + 60 * MIN, true);
    expect(closed).toEqual({ startedAt: iso(T0), endedAt: iso(T0 + 5 * MIN) });
    expect(next.sessionStartedAt).toBe(iso(T0 + 60 * MIN));
  });

  it("sessão já encerrada não fecha de novo", () => {
    const ended = { ...applyHeartbeat(null, T0, true).next, open: false };
    expect(applyHeartbeat(ended, T0 + MIN, true).closed).toBeNull();
  });
});

describe("shouldWriteHeartbeat e duração", () => {
  it("várias abas no mesmo minuto não viram várias escritas, mas mudar de estado grava", () => {
    expect(shouldWriteHeartbeat(undefined, T0, true)).toBe(true);
    expect(shouldWriteHeartbeat({ at: T0, active: true }, T0 + 20_000, true)).toBe(false);
    expect(shouldWriteHeartbeat({ at: T0, active: true }, T0 + 20_000, false)).toBe(true);
    expect(shouldWriteHeartbeat({ at: T0, active: true }, T0 + 50_000, true)).toBe(true);
  });

  it("duração em minutos", () => {
    expect(sessionDurationMinutes(iso(T0), iso(T0 + 5 * MIN))).toBe(5);
    expect(sessionDurationMinutes("x", iso(T0))).toBe(0);
  });
});

describe("recordHeartbeat e o ciclo da sessão", () => {
  const base = { tenantId: "awa", uid: "ana", role: "MEMBER", name: "Ana", email: "ana@awa.com" };

  it("entrou 10:15 e continua online", async () => {
    // Avisos de minuto em minuto, sem intervalo maior que 3 min.
    for (let m = 0; m <= 60; m += 1) {
      await recordHeartbeat({ ...base, active: true, nowMs: T0 + m * MIN });
      clearPresenceCachesForTest();
    }
    const company = summarizeTenantPresence(store.tenant_presence.awa, T0 + 60 * MIN);
    expect(company).toMatchObject({ status: "online" });
    const person = store["tenant_presence/awa/people"].ana;
    expect(person).toMatchObject({
      name: "Ana",
      open: true,
      sessionStartedAt: iso(T0),
      lastHeartbeatAt: iso(T0 + 60 * MIN),
    });
    expect(recordTenantActivity).not.toHaveBeenCalled();
  });

  it("entrou 10:15, olhou algo e saiu: o painel encerra e grava a sessão de 5 min", async () => {
    for (let m = 0; m <= 5; m += 1) {
      clearPresenceCachesForTest();
      await recordHeartbeat({ ...base, active: true, nowMs: T0 + m * MIN });
    }
    await closeStaleSessions({ nowMs: T0 + 20 * MIN, force: true });

    expect(store["tenant_presence/awa/people"].ana).toMatchObject({ open: false, endedAt: iso(T0 + 5 * MIN) });
    expect(store.tenant_presence.awa.hasOpenSession).toBe(false);
    expect(recordTenantActivity).toHaveBeenCalledTimes(1);
    expect(recordTenantActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "awa",
        uid: "ana",
        type: "session_ended",
        atMs: T0 + 5 * MIN,
        meta: { durationMinutes: 5 },
        docId: `session_awa_ana_${T0}`,
      }),
    );

    const summary = summarizeTenantPresence(store.tenant_presence.awa, T0 + 20 * MIN);
    expect(summary).toEqual({ status: "offline", sessionStartedAt: iso(T0), lastHeartbeatAt: iso(T0 + 5 * MIN) });
  });

  it("quem volta depois de sair fecha a sessão anterior no próprio aviso", async () => {
    await recordHeartbeat({ ...base, active: true, nowMs: T0 });
    clearPresenceCachesForTest();
    await recordHeartbeat({ ...base, active: true, nowMs: T0 + 2 * MIN });
    clearPresenceCachesForTest();
    await recordHeartbeat({ ...base, active: true, nowMs: T0 + 90 * MIN });

    expect(recordTenantActivity).toHaveBeenCalledWith(
      expect.objectContaining({ type: "session_ended", meta: { durationMinutes: 2 } }),
    );
    expect(store["tenant_presence/awa/people"].ana.sessionStartedAt).toBe(iso(T0 + 90 * MIN));
  });

  it("uma pessoa saiu e outra continua: só a que saiu é encerrada", async () => {
    await recordHeartbeat({ ...base, active: true, nowMs: T0 });
    for (let m = 0; m <= 10; m += 1) {
      clearPresenceCachesForTest();
      await recordHeartbeat({ ...base, uid: "bia", name: "Bia", active: true, nowMs: T0 + m * MIN });
    }
    await closeStaleSessions({ nowMs: T0 + 10 * MIN, force: true });

    expect(store["tenant_presence/awa/people"].ana.open).toBe(false);
    expect(store["tenant_presence/awa/people"].bia.open).toBe(true);
    expect(store.tenant_presence.awa.hasOpenSession).toBe(true);
  });

  it("super admin não conta", async () => {
    await recordHeartbeat({ ...base, role: "SUPERADMIN", active: true, nowMs: T0 });
    expect(store.tenant_presence).toBeUndefined();
  });
});

describe("listTenantPresence", () => {
  it("lista quem está online antes de quem já saiu, com cada pessoa", async () => {
    const base = { role: "MEMBER", active: true };
    await recordHeartbeat({ ...base, tenantId: "saiu", uid: "x", name: "X", nowMs: T0 });
    for (let m = 0; m <= 30; m += 1) {
      clearPresenceCachesForTest();
      await recordHeartbeat({ ...base, tenantId: "awa", uid: "ana", name: "Ana", nowMs: T0 + m * MIN });
    }

    const list = await listTenantPresence(iso(T0 - 60 * MIN), T0 + 30 * MIN);
    expect(list.map((e) => [e.tenantId, e.status])).toEqual([
      ["awa", "online"],
      ["saiu", "offline"],
    ]);
    expect(list[0].people[0]).toMatchObject({ uid: "ana", name: "Ana", status: "online", sessionStartedAt: iso(T0) });
  });
});
