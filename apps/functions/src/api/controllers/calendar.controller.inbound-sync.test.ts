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
        set: (_ref: unknown, data: Record<string, unknown>) => written.push(data),
        commit: async () => undefined,
      }),
    },
  };
});

import {
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
  decryptToken.mockClear();
  eventsList.mockReset();
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
