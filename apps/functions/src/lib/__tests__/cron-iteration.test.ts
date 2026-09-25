import { mapWithConcurrency, paginateQuery, runRotatingCursor } from "../cron-iteration";

function fakeQuery(total: number) {
  const ids = Array.from({ length: total }, (_, i) => `d${String(i).padStart(4, "0")}`);
  const pages: number[] = [];
  const build = (after: string | null, lim: number): unknown => ({
    limit: (n: number) => build(after, n),
    startAfter: (doc: { id: string }) => build(doc.id, lim),
    get: async () => {
      const start = after ? ids.indexOf(after) + 1 : 0;
      const docs = ids.slice(start, start + lim).map((id) => ({ id }));
      pages.push(docs.length);
      return { docs };
    },
  });
  return { query: build(null, 0) as FirebaseFirestore.Query, pages };
}

it("paginateQuery percorre tudo, além do primeiro limite", async () => {
  const { query, pages } = fakeQuery(450);
  const seen: string[] = [];
  for await (const doc of paginateQuery(query, 200)) seen.push(doc.id);
  expect(seen).toHaveLength(450);
  expect(new Set(seen).size).toBe(450);
  expect(pages).toEqual([200, 200, 50]);
});

it("paginateQuery com total múltiplo da página faz uma leitura vazia no fim", async () => {
  const { query, pages } = fakeQuery(400);
  let count = 0;
  for await (const _doc of paginateQuery(query, 200)) count++;
  expect(count).toBe(400);
  expect(pages).toEqual([200, 200, 0]);
});

it("mapWithConcurrency respeita o limite e processa todos", async () => {
  let running = 0;
  let peak = 0;
  const done: number[] = [];
  await mapWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 4, async (i) => {
    running++;
    peak = Math.max(peak, running);
    await new Promise((r) => setTimeout(r, 2));
    done.push(i);
    running--;
  });
  expect(done.sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i));
  expect(peak).toBe(4);
});

describe("runRotatingCursor", () => {
  function fakeDb(total: number, cursor: string | null) {
    const ids = Array.from({ length: total }, (_, i) => `d${String(i).padStart(4, "0")}`);
    const store: Record<string, unknown> = { lastDocId: cursor };
    const build = (after: string | null, lim: number): unknown => ({
      limit: (n: number) => build(after, n),
      startAfter: (doc: { id: string }) => build(doc.id, lim),
      get: async () => {
        const start = after ? ids.indexOf(after) + 1 : 0;
        const docs = ids.slice(start, start + lim).map((id) => ({ id }));
        return { docs, empty: docs.length === 0 };
      },
    });
    const db = {
      collection: (name: string) => ({
        doc: (id: string) =>
          name === "cron_cursors"
            ? {
                get: async () => ({ exists: true, data: () => store }),
                set: async (data: Record<string, unknown>) => Object.assign(store, data),
              }
            : { get: async () => ({ exists: ids.includes(id), id }) },
      }),
    };
    return { db: db as unknown as FirebaseFirestore.Firestore, query: build(null, 0) as FirebaseFirestore.Query, store };
  }

  it("para no prazo, grava onde parou, e a próxima execução continua dali", async () => {
    const { db, query, store } = fakeDb(1000, null);
    const seen: string[] = [];
    let clock = 0;
    const run = () =>
      runRotatingCursor({
        db, cursorId: "x", collectionName: "c", baseQuery: query, pageSize: 100,
        deadlineMs: clock + 250,
        now: () => clock,
        processPage: async (docs) => {
          seen.push(...docs.map((d) => d.id));
          clock += 100;
        },
      });

    const first = await run();
    expect(first.completedCycle).toBe(false);
    expect(seen).toHaveLength(300);
    expect(store.lastDocId).toBe("d0299");

    await run();
    expect(seen.slice(300, 301)).toEqual(["d0300"]);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("ao chegar ao fim, zera o cursor para recomeçar do início", async () => {
    const { db, query, store } = fakeDb(150, "d0099");
    const seen: string[] = [];
    const result = await runRotatingCursor({
      db, cursorId: "x", collectionName: "c", baseQuery: query, pageSize: 100,
      deadlineMs: Number.MAX_SAFE_INTEGER,
      processPage: async (docs) => void seen.push(...docs.map((d) => d.id)),
    });
    expect(seen[0]).toBe("d0100");
    expect(seen).toHaveLength(50);
    expect(result.completedCycle).toBe(true);
    expect(store.lastDocId).toBeNull();
  });

  it("sem cursorId (dry run) começa do início e não grava nada", async () => {
    const { db, query, store } = fakeDb(10, "d0005");
    const seen: string[] = [];
    await runRotatingCursor({
      db, cursorId: null, collectionName: "c", baseQuery: query, pageSize: 100,
      deadlineMs: Number.MAX_SAFE_INTEGER,
      processPage: async (docs) => void seen.push(...docs.map((d) => d.id)),
    });
    expect(seen[0]).toBe("d0000");
    expect(store.lastDocId).toBe("d0005");
  });
});
