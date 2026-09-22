import { describe, expect, it } from "vitest";

import { MARCOS } from "@/app/(empresa)/institucional/_content/institucional-copy";

import { commitsDosMarcos, hashCurto } from "../git-log";

describe("git log do /sobre", () => {
  it("o hash é estável, curto e hexadecimal", () => {
    expect(hashCurto("Uma proposta que levava horas")).toBe(hashCurto("Uma proposta que levava horas"));
    for (const marco of MARCOS) expect(hashCurto(marco.titulo)).toMatch(/^[0-9a-f]{7}$/);
  });

  it("cada marco tem um hash diferente", () => {
    const hashes = MARCOS.map((m) => hashCurto(m.titulo));
    expect(new Set(hashes).size).toBe(hashes.length);
  });

  it("do mais novo ao mais antigo, com o aplicativo no ramo e o ERP na ponta do tronco", () => {
    const commits = commitsDosMarcos(MARCOS);
    expect(commits).toHaveLength(MARCOS.length);
    expect(commits[0].titulo).toBe(MARCOS[MARCOS.length - 1].titulo);
    expect(commits[commits.length - 1].titulo).toBe(MARCOS[0].titulo);
    expect(commits[0]).toMatchObject({ trilha: 1, ramo: "aplicativo" });
    expect(commits[1]).toMatchObject({ trilha: 0, ramo: "erp" });
    expect(commits.slice(2).every((c) => c.trilha === 0 && !c.ramo)).toBe(true);
  });
});
