import { describe, expect, it } from "vitest";
import { keepIfUnchanged } from "../keep-if-unchanged";

class FakeTimestamp {
  constructor(public seconds: number) {}
  isEqual(other: unknown) {
    return other instanceof FakeTimestamp && other.seconds === this.seconds;
  }
}

describe("keepIfUnchanged", () => {
  it("mesmo conteúdo mantém a referência anterior", () => {
    const prev = { id: "t1", name: "Acme", niche: "cortinas", modules: ["a", "b"], meta: { x: 1 } };
    const next = { id: "t1", name: "Acme", niche: "cortinas", modules: ["a", "b"], meta: { x: 1 } };
    expect(keepIfUnchanged(prev, next)).toBe(prev);
  });

  it("Timestamps iguais contam como iguais", () => {
    const prev = { id: "t1", createdAt: new FakeTimestamp(10) };
    const next = { id: "t1", createdAt: new FakeTimestamp(10) };
    expect(keepIfUnchanged(prev, next)).toBe(prev);
  });

  it("campo alterado troca a referência", () => {
    const prev = { id: "t1", name: "Acme" };
    const next = { id: "t1", name: "Acme Ltda" };
    expect(keepIfUnchanged(prev, next)).toBe(next);
  });

  it("campo novo, campo removido, item de lista e Timestamp diferentes trocam", () => {
    expect(keepIfUnchanged<Record<string, unknown>>({ id: "t1" }, { id: "t1", logo: "x" })).toEqual({ id: "t1", logo: "x" });
    const removed = { id: "t1" };
    expect(keepIfUnchanged<Record<string, unknown>>({ id: "t1", logo: "x" }, removed)).toBe(removed);
    const list = { l: [1, 3] };
    expect(keepIfUnchanged({ l: [1, 2] }, list)).toBe(list);
    const ts = { c: new FakeTimestamp(11) };
    expect(keepIfUnchanged({ c: new FakeTimestamp(10) }, ts)).toBe(ts);
  });

  it("null e troca de tenant", () => {
    const next = { id: "t2" };
    expect(keepIfUnchanged<{ id: string } | null>(null, next)).toBe(next);
    expect(keepIfUnchanged<{ id: string } | null>({ id: "t1" }, next)).toBe(next);
  });
});
