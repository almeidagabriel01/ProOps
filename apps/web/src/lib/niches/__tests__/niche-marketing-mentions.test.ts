import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { HEROI_RAIZ } from "@/app/(empresa)/institucional/_content/institucional-copy";
import { NICHE_REGISTRY, TENANT_NICHES } from "@/lib/niches/registry";

/**
 * Alguns textos de marketing enumeram os nichos prontos em prosa: o manifest
 * do app, as palavras-chave do site e a resposta "serve para o meu segmento?".
 * Prosa não deriva de lista, e já saiu errada ("dois segmentos já vêm prontos"
 * com três no ar). Este teste cobra, a cada nicho novo, que esses textos o
 * citem, e que nenhum volte a contar os nichos por extenso.
 */
const SRC = path.resolve(__dirname, "../../..");
const read = (file: string) => fs.readFileSync(path.join(SRC, file), "utf8").toLowerCase();

const ENUMERATIONS = {
  "app/manifest.ts": read("app/manifest.ts"),
  "app/layout.tsx (keywords)": read("app/layout.tsx"),
  "components/landing/_shared/faq-data.ts": read("components/landing/_shared/faq-data.ts"),
};

describe.each(Object.entries(ENUMERATIONS))("%s", (_file, text) => {
  it.each([...TENANT_NICHES])("cita o nicho %s", (niche) => {
    expect(text).toContain(NICHE_REGISTRY[niche].label.toLowerCase());
  });
});

describe("contagem de nichos por extenso", () => {
  // Três textos já contaram os nichos e ficaram velhos com um nicho novo: o
  // herói da institucional, a seção "O seu segmento" ("dois segmentos que já
  // vêm prontos") e a galeria da landing ("Dois pacotes prontos, e o seu"). Os
  // dois últimos moravam no JSX, fora de qualquer lista, e por isso a varredura
  // cobre todo o texto de marketing. Comentário de código fica de fora.
  it("nenhum texto de marketing conta os nichos por extenso", () => {
    const CONTAGEM = /\b(dois|duas|três|quatro|cinco|seis|sete) (segmentos|pacotes|nichos)\b/i;
    const PASTAS = ["components/landing", "components/marketing", "app/(empresa)", "app/aplicativo", "lib/niches/definitions", "lib/landing"];
    const semComentario = (texto: string) => texto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const arquivos = (dir: string): string[] =>
      fs.readdirSync(path.join(SRC, dir), { withFileTypes: true }).flatMap((e) => {
        const rel = path.join(dir, e.name);
        if (e.isDirectory()) return e.name === "__tests__" ? [] : arquivos(rel);
        return /\.tsx?$/.test(e.name) ? [rel] : [];
      });
    const achados = PASTAS.flatMap(arquivos).filter((f) =>
      CONTAGEM.test(semComentario(fs.readFileSync(path.join(SRC, f), "utf8"))),
    );
    expect(achados).toEqual([]);
  });

  it("o herói do site da empresa não conta os segmentos prontos", () => {
    expect(HEROI_RAIZ.lead).not.toMatch(/\b(dois|duas|três|quatro|cinco) segmentos\b/i);
  });
});
