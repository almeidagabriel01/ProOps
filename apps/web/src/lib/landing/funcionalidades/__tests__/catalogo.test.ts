import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { CATALOGO, CATEGORIAS, DESTAQUES, nichosDoRecurso } from "..";

const APP = path.resolve(__dirname, "../../../../app");

/**
 * Procura `app/<rota>/page.tsx`, atravessando route groups (`(empresa)`), que
 * não entram na URL.
 */
function paginaExiste(rota: string, base = APP): boolean {
  const partes = rota.split("/").filter(Boolean);
  if (partes.length === 0) return existsSync(path.join(base, "page.tsx"));
  const [primeira, ...resto] = partes;
  if (existsSync(path.join(base, primeira)) && paginaExiste(resto.join("/"), path.join(base, primeira))) {
    return true;
  }
  return readdirSync(base)
    .filter((d) => /^\(.+\)$/.test(d) && statSync(path.join(base, d)).isDirectory())
    .some((grupo) => paginaExiste(rota, path.join(base, grupo)));
}

describe("catálogo de funcionalidades", () => {
  it("ids únicos, em kebab-case", () => {
    const ids = CATALOGO.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("toda categoria tem recurso, e todo recurso tem categoria conhecida", () => {
    const categorias = new Set(CATEGORIAS.map((c) => c.id));
    for (const c of CATEGORIAS) {
      expect(CATALOGO.some((r) => r.categoria === c.id)).toBe(true);
    }
    for (const r of CATALOGO) expect(categorias.has(r.categoria)).toBe(true);
  });

  it.each(CATALOGO.filter((r) => r.rota).map((r) => [r.id, r.rota!] as const))(
    "%s aponta para uma tela que existe (%s)",
    (_id, rota) => {
      expect(paginaExiste(rota)).toBe(true);
    },
  );

  it.each(CATALOGO.filter((r) => r.exemplo).map((r) => [r.id, r.exemplo!.href] as const))(
    "%s leva a um exemplo navegável (%s)",
    (_id, href) => {
      const tipo = href.split("/")[2];
      expect(existsSync(path.join(APP, "share", tipo, "[token]", "page.tsx"))).toBe(true);
    },
  );

  it("recurso que depende do nicho existe em pelo menos um nicho", () => {
    for (const r of CATALOGO.filter((x) => x.nichos)) {
      expect(nichosDoRecurso(r.nichos).length).toBeGreaterThan(0);
    }
  });

  it("texto curto: resumo numa linha, detalhes contados", () => {
    for (const r of CATALOGO) {
      expect(r.resumo.length).toBeLessThanOrEqual(120);
      expect(r.detalhes.length).toBeGreaterThan(0);
      expect(r.detalhes.length).toBeLessThanOrEqual(4);
    }
  });
});

describe("destaques da home", () => {
  it("são cinco, e citam só recursos do catálogo", () => {
    expect(DESTAQUES).toHaveLength(5);
    const ids = new Set(CATALOGO.map((r) => r.id));
    for (const d of DESTAQUES) {
      expect(ids.has(d.principal)).toBe(true);
      expect(d.recursos).toContain(d.principal);
      for (const id of d.recursos) expect(ids.has(id)).toBe(true);
    }
  });

  it("cada destaque aponta para um capítulo que existe", () => {
    const categorias = new Set(CATEGORIAS.map((c) => c.id));
    for (const d of DESTAQUES) expect(categorias.has(d.ancora)).toBe(true);
  });
});
