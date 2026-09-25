import { mapWithConcurrency, paginateQuery } from "../cron-iteration";

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
