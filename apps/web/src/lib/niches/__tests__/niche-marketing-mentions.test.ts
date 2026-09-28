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
  // A seção "O seu segmento" disse "dois segmentos que já vêm prontos" com três
  // no ar, e ninguém percebeu porque o texto mora no JSX.
  it("a seção de segmentos do site da empresa não conta os pacotes prontos", () => {
    expect(read("app/(empresa)/institucional/_components/institucional-segmento.tsx")).not.toMatch(
      /\b(dois|duas|três|quatro|cinco|seis) (segmentos|pacotes|nichos)\b/i,
    );
  });

  it("o herói do site da empresa não conta os segmentos prontos", () => {
    expect(HEROI_RAIZ.lead).not.toMatch(/\b(dois|duas|três|quatro|cinco) segmentos\b/i);
  });
});
