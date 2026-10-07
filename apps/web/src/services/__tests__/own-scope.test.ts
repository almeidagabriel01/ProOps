/**
 * A lista de quem vê só os próprios registros é montada na memória: a ordem
 * tem que ser a do `orderBy` (data como Timestamp, ISO ou dia) e a página
 * continua do cursor, como a paginação do Firestore.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase", () => ({ db: {} }));

import { pageAfter, sortSnapshots } from "../own-scope";

const snap = (id: string, data: Record<string, unknown>) =>
  ({ id, data: () => data }) as unknown as Parameters<typeof sortSnapshots>[0][number];

const ts = (ms: number) => ({ toMillis: () => ms });

describe("sortSnapshots", () => {
  it("ordena Timestamp, número e texto como o orderBy", () => {
    const docs = [snap("a", { createdAt: ts(2) }), snap("b", { createdAt: ts(3) }), snap("c", { createdAt: ts(1) })];
    expect(sortSnapshots(docs, "createdAt", "desc").map((d) => d.id)).toEqual(["b", "a", "c"]);
    const names = [snap("x", { title: "beta" }), snap("y", { title: "Alfa" })];
    expect(sortSnapshots(names, "title", "asc").map((d) => d.id)).toEqual(["y", "x"]);
  });
});

describe("pageAfter", () => {
  const docs = ["a", "b", "c", "d", "e"].map((id) => snap(id, {}));

  it("primeira página, depois do cursor, e o fim", () => {
    const first = pageAfter(docs, null, 2, (d) => d.id);
    expect(first).toMatchObject({ data: ["a", "b"], hasMore: true });
    const second = pageAfter(docs, first.lastDoc, 2, (d) => d.id);
    expect(second).toMatchObject({ data: ["c", "d"], hasMore: true });
    const last = pageAfter(docs, second.lastDoc, 2, (d) => d.id);
    expect(last).toMatchObject({ data: ["e"], hasMore: false });
  });
});
