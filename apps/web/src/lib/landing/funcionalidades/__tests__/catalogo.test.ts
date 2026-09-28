import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  CATALOGO,
  DESTAQUES,
  FUNCIONALIDADE_SLUGS,
  FUNCIONALIDADES,
  GRUPOS_DE_FUNCIONALIDADES,
  nichosDoRecurso,
} from "..";

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

  it("todo recurso pertence a exatamente uma funcionalidade", () => {
    for (const r of CATALOGO) {
      const donas = FUNCIONALIDADES.filter((f) => f.recursos.includes(r.id)).map((f) => f.slug);
      expect(donas, r.id).toHaveLength(1);
    }
    const citados = FUNCIONALIDADES.flatMap((f) => f.recursos);
    const ids = new Set(CATALOGO.map((r) => r.id));
    for (const id of citados) expect(ids.has(id), id).toBe(true);
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

describe("funcionalidades", () => {
  it("uma por slug, na ordem dos slugs, com slug em kebab-case", () => {
    expect(FUNCIONALIDADES.map((f) => f.slug)).toEqual([...FUNCIONALIDADE_SLUGS]);
    for (const slug of FUNCIONALIDADE_SLUGS) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("o recurso do selo é um dos que ela reúne", () => {
    for (const f of FUNCIONALIDADES) expect(f.recursos, f.slug).toContain(f.principal);
  });

  it("todo grupo tem funcionalidade, e toda funcionalidade tem grupo conhecido", () => {
    const grupos = new Set(GRUPOS_DE_FUNCIONALIDADES.map((g) => g.id));
    for (const g of GRUPOS_DE_FUNCIONALIDADES) {
      expect(FUNCIONALIDADES.some((f) => f.grupo === g.id)).toBe(true);
    }
    for (const f of FUNCIONALIDADES) expect(grupos.has(f.grupo)).toBe(true);
  });

  it("relacionadas apontam para outras funcionalidades, sem repetir", () => {
    for (const f of FUNCIONALIDADES) {
      expect(f.relacionadas.length).toBeGreaterThan(0);
      expect(f.relacionadas).not.toContain(f.slug);
      expect(new Set(f.relacionadas).size).toBe(f.relacionadas.length);
    }
  });

  it("três passos, e a explicação da lista cabe numa linha", () => {
    for (const f of FUNCIONALIDADES) {
      expect(f.pagina.passos, f.slug).toHaveLength(3);
      expect(f.resumo.length, f.slug).toBeLessThanOrEqual(110);
    }
  });

  it("cada slug tem a sua página, gerada da mesma lista", () => {
    expect(existsSync(path.join(APP, "funcionalidades", "[slug]", "page.tsx"))).toBe(true);
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

  it("cada destaque abre a funcionalidade que reúne o recurso principal dele", () => {
    for (const d of DESTAQUES) {
      const pagina = FUNCIONALIDADES.find((f) => f.slug === d.funcionalidade);
      expect(pagina, d.id).toBeDefined();
      expect(pagina!.recursos, d.id).toContain(d.principal);
    }
  });
});
