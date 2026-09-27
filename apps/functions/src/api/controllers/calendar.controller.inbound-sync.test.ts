/**
 * Sync de entrada do Google Agenda (roda a cada listagem, com throttle de 15s):
 * - decifra o token (KMS) só DEPOIS do throttle;
 * - busca os eventos locais pelos ids que o Google devolveu, não a agenda toda;
 * - pagina o events.list (antes truncava em 250);
 * - não regrava evento que não mudou.
 */
process.env.GOOGLE_CALENDAR_SYNC_ENABLED = "true";
process.env.GOOGLE_CALENDAR_CLIENT_ID = "cid";
process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "secret";

const decryptToken = jest.fn(async () => "refresh-token");
jest.mock("../../lib/token-encryption", () => ({
  encryptToken: jest.fn(),
  decryptToken: () => decryptToken(),
  isEncryptedToken: jest.fn(() => true),
}));
jest.mock("../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mirror = jest.fn(async () => undefined);
jest.mock("../services/projects/project-schedule-store", () => ({
  mirrorStageScheduleFromEvent: (...a: unknown[]) => mirror(...(a as [])),
}));

const eventsList = jest.fn();
jest.mock("@googleapis/calendar", () => ({
  calendar: () => ({ events: { list: (...a: unknown[]) => eventsList(...a) } }),
  auth: {
    OAuth2: class {
      setCredentials() {}
    },
  },
}));

type Stored = { id: string; data: Record<string, unknown> };
let integration: Record<string, unknown>;
let localEvents: Stored[];
const eventQueries: unknown[][][] = [];
const written: Array<Record<string, unknown>> = [];
const writtenIds: string[] = [];
const deletedIds: string[] = [];

jest.mock("../../init", () => {
  const eventsCollection = () => {
    const build = (wheres: unknown[][]): unknown => ({
      where: (...args: unknown[]) => build([...wheres, args]),
      get: async () => {
        eventQueries.push(wheres);
        const inFilter = wheres.find((w) => w[1] === "in");
        const ids = (inFilter?.[2] as string[]) || [];
        const docs = localEvents
          .filter((e) => ids.includes(String((e.data.googleSync as { externalEventId?: string })?.externalEventId)))
          .map((e) => ({ id: e.id, data: () => e.data }));
        return { docs };
      },
    });
    return {
      ...(build([]) as object),
      doc: (id?: string) => ({ id: id || `new-${written.length}` }),
    };
  };
  return {
    db: {
      collection: (name: string) => {
        if (name === "calendar_events") return eventsCollection();
        return {
          doc: () => ({
            get: async () => ({ id: "t1", data: () => integration }),
            set: async () => undefined,
          }),
          where: () => ({ where: () => ({ where: () => ({ get: async () => ({ empty: true, docs: [] }) }) }) }),
        };
      },
      batch: () => ({
        set: (ref: { id: string }, data: Record<string, unknown>) => {
          writtenIds.push(ref.id);
          written.push(data);
        },
        delete: (ref: { id: string }) => deletedIds.push(ref.id),
        commit: async () => undefined,
      }),
    },
  };
});

import {
  importedCalendarEventDocId,
  isSameImportedCalendarEvent,
  syncGoogleEventsToLocalCalendar,
} from "./calendar.controller";

const RANGE = { tenantId: "t1", startMs: Date.parse("2026-09-01"), endMs: Date.parse("2026-10-01") };

function googleEvent(id: string, summary = "Visita") {
  return {
    id,
    status: "confirmed",
    summary,
    start: { dateTime: "2026-09-10T13:00:00-03:00" },
    end: { dateTime: "2026-09-10T14:00:00-03:00" },
  };
}

beforeEach(() => {
  integration = {
    tenantId: "t1",
    provider: "google",
    enabled: true,
    calendarId: "primary",
    refreshTokenEnc: "enc:abc",
    connectedByUserId: "u1",
  };
  localEvents = [];
  eventQueries.length = 0;
  written.length = 0;
  writtenIds.length = 0;
  deletedIds.length = 0;
  decryptToken.mockClear();
  eventsList.mockReset();
  mirror.mockClear();
});

it("dentro do throttle não decifra o token nem chama o Google", async () => {
  integration.lastInboundSyncAt = new Date().toISOString();
  await syncGoogleEventsToLocalCalendar(RANGE);
  expect(decryptToken).not.toHaveBeenCalled();
  expect(eventsList).not.toHaveBeenCalled();
});

it("pagina o events.list e busca os locais só pelos ids devolvidos", async () => {
  eventsList
    .mockResolvedValueOnce({ data: { items: [googleEvent("g1")], nextPageToken: "p2" } })
    .mockResolvedValueOnce({ data: { items: [googleEvent("g2")] } });

  await syncGoogleEventsToLocalCalendar(RANGE);

  expect(decryptToken).toHaveBeenCalledTimes(1);
  expect(eventsList).toHaveBeenCalledTimes(2);
  expect(eventsList.mock.calls[1][0]).toMatchObject({ pageToken: "p2" });
  expect(eventQueries).toEqual([
    [
      ["tenantId", "==", "t1"],
      ["googleSync.externalEventId", "in", ["g1", "g2"]],
    ],
  ]);
  expect(written).toHaveLength(2);
});

it("evento que não mudou no Google não é regravado; o que mudou é", async () => {
  eventsList.mockResolvedValue({ data: { items: [googleEvent("g1"), googleEvent("g2")] } });
  await syncGoogleEventsToLocalCalendar(RANGE);
  localEvents = written.map((data, i) => ({ id: `e${i}`, data }));
  written.length = 0;

  eventsList.mockResolvedValue({
    data: { items: [googleEvent("g1"), googleEvent("g2", "Visita remarcada")] },
  });
  await syncGoogleEventsToLocalCalendar(RANGE);

  expect(written).toHaveLength(1);
  expect(written[0]).toMatchObject({ title: "Visita remarcada" });
});

it("isSameImportedCalendarEvent ignora só os carimbos de sincronização", () => {
  const base = {
    title: "Visita",
    updatedAt: "2026-09-01T00:00:00Z",
    googleSync: { externalEventId: "g1", lastSyncedAt: "a", lastAttemptAt: "a", status: "synced" },
  } as never;
  const sameButLater = {
    title: "Visita",
    updatedAt: "2026-09-02T00:00:00Z",
    googleSync: { externalEventId: "g1", lastSyncedAt: "b", lastAttemptAt: "b", status: "synced" },
  } as never;
  const removed = {
    title: "Visita",
    updatedAt: "2026-09-02T00:00:00Z",
    googleSync: { externalEventId: "g1", lastSyncedAt: "b", lastAttemptAt: "b", status: "removed" },
  } as never;
  expect(isSameImportedCalendarEvent(base, sameButLater)).toBe(true);
  expect(isSameImportedCalendarEvent(base, removed)).toBe(false);
});

it("visita de obra mudada no Google mantém o vínculo e muda a data da etapa", async () => {
  eventsList.mockResolvedValue({ data: { items: [googleEvent("g1")] } });
  await syncGoogleEventsToLocalCalendar(RANGE);
  // O evento local é a visita da obra; no Google ela foi para as 15h.
  localEvents = [{ id: "ev-obra", data: { ...written[0], projectId: "p1", projectStageId: "s1" } }];
  written.length = 0;
  integration.lastInboundSyncAt = null;
  eventsList.mockResolvedValue({
    data: {
      items: [
        {
          ...googleEvent("g1"),
          start: { dateTime: "2026-09-10T15:00:00-03:00" },
          end: { dateTime: "2026-09-10T16:00:00-03:00" },
        },
      ],
    },
  });

  await syncGoogleEventsToLocalCalendar(RANGE);

  expect(written).toHaveLength(1);
  expect(written[0]).toMatchObject({ projectId: "p1", projectStageId: "s1" });
  expect(mirror).toHaveBeenCalledWith(
    expect.objectContaining({
      projectId: "p1",
      stageId: "s1",
      eventId: "ev-obra",
      schedule: expect.objectContaining({ startMs: Date.parse("2026-09-10T15:00:00-03:00") }),
    }),
  );
});

describe("evento importado não duplica", () => {
  const idDe = (externalEventId: string) =>
    importedCalendarEventDocId({ tenantId: "t1", calendarId: "primary", externalEventId });

  function importado(id: string, externalEventId: string, extra: Record<string, unknown> = {}) {
    return {
      id,
      data: {
        tenantId: "t1",
        title: "Entrevista",
        createdAt: "2026-09-27T16:08:58.000Z",
        googleSync: { provider: "google", origin: "imported", externalEventId },
        ...extra,
      },
    };
  }

  it("duas sincronizações simultâneas gravam o MESMO documento", async () => {
    // O caso real: a tela busca o mês e os próximos compromissos ao mesmo
    // tempo, e as duas buscas viam o evento como novo.
    eventsList.mockResolvedValue({ data: { items: [googleEvent("g1")] } });

    await Promise.all([
      syncGoogleEventsToLocalCalendar(RANGE),
      syncGoogleEventsToLocalCalendar({ ...RANGE, endMs: Date.parse("2026-12-01") }),
    ]);

    expect(writtenIds).toEqual([idDe("g1"), idDe("g1")]);
  });

  it("o id muda por empresa e por evento", () => {
    expect(idDe("g1")).not.toBe(idDe("g2"));
    expect(idDe("g1")).not.toBe(
      importedCalendarEventDocId({ tenantId: "t2", calendarId: "primary", externalEventId: "g1" }),
    );
    expect(idDe("g1")).toMatch(/^gcal_[0-9a-f]{40}$/);
  });

  it("evento já importado com id antigo continua no mesmo documento", async () => {
    localEvents = [importado("antigo-1", "g1")];
    eventsList.mockResolvedValue({ data: { items: [googleEvent("g1", "Mudou no Google")] } });

    await syncGoogleEventsToLocalCalendar(RANGE);

    expect(writtenIds).toEqual(["antigo-1"]);
    expect(deletedIds).toEqual([]);
  });

  it("apaga a cópia a mais e mantém a mais antiga", async () => {
    localEvents = [
      importado("copia-b", "g1", { createdAt: "2026-09-27T16:08:58.473Z" }),
      importado("copia-a", "g1", { createdAt: "2026-09-27T16:08:58.272Z" }),
    ];
    eventsList.mockResolvedValue({ data: { items: [googleEvent("g1")] } });

    await syncGoogleEventsToLocalCalendar(RANGE);

    expect(deletedIds).toEqual(["copia-b"]);
    expect(writtenIds).not.toContain("copia-b");
  });

  it("prefere a cópia de id derivado", async () => {
    localEvents = [
      importado("copia-antiga", "g1", { createdAt: "2026-01-01T00:00:00.000Z" }),
      importado(idDe("g1"), "g1", { createdAt: "2026-09-27T00:00:00.000Z" }),
    ];
    eventsList.mockResolvedValue({ data: { items: [googleEvent("g1")] } });

    await syncGoogleEventsToLocalCalendar(RANGE);

    expect(deletedIds).toEqual(["copia-antiga"]);
  });

  it("nunca apaga cópia ligada a obra ou agendamento, nem a que nasceu na ProOps", async () => {
    localEvents = [
      importado("da-obra", "g1", { projectId: "p1", createdAt: "2026-09-27T17:00:00.000Z" }),
      importado("importada", "g1", { createdAt: "2026-09-27T10:00:00.000Z" }),
      {
        id: "da-proops",
        data: {
          tenantId: "t1",
          createdAt: "2026-09-27T09:00:00.000Z",
          googleSync: { provider: "google", origin: "local", externalEventId: "g1" },
        },
      },
      importado("do-agendamento", "g1", { bookingRequestId: "b1" }),
    ];
    eventsList.mockResolvedValue({ data: { items: [googleEvent("g1")] } });

    await syncGoogleEventsToLocalCalendar(RANGE);

    expect(deletedIds).toEqual(["importada"]);
  });
});
