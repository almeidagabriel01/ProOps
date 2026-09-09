import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { rotasDoSitemap } from "@/lib/site/host-seo";
import {
  APP_ROOT,
  INSTITUCIONAL_ROOT,
  type Surface,
} from "@/lib/site/surfaces";

/**
 * Toda rota que entra num sitemap declara o próprio canonical.
 *
 * O root layout define `alternates: { canonical: "/" }`, e em Next isso é
 * HERDADO por qualquer página que não defina o seu. O efeito é silencioso e do
 * pior tipo: a página renderiza normalmente e declara, na tag canonical, ser
 * uma cópia da home. Foi o que aconteceu com as quatro páginas legais, que
 * ficaram assim desde sempre e só apareceram quando alguém foi olhar o HTML.
 *
 * Com três hosts o mesmo esquecimento custa mais caro: só a raiz é reescrita,
 * então uma rota compartilhada responde 200 nos três domínios, e sem canonical
 * próprio ela é conteúdo triplicado.
 *
 * Este guard é estrutural de propósito: ele não julga o VALOR do canonical (o
 * host-seo.test.ts faz isso), só exige que a rota tenha um. É a metade que
 * pega o próximo esquecimento.
 */

const APP_DIR = path.resolve(__dirname, "..", "app");

/** Onde mora o `page.tsx` que responde por um caminho de uma superfície. */
function arquivoDaRota(surface: Surface, rota: string): string {
  if (rota === "/") {
    if (surface === "app") return path.join(APP_DIR, APP_ROOT, "page.tsx");
    if (surface === "institucional") {
      return path.join(APP_DIR, INSTITUCIONAL_ROOT, "page.tsx");
    }
    return path.join(APP_DIR, "page.tsx");
  }
  return path.join(APP_DIR, rota, "page.tsx");
}

const SUPERFICIES: Surface[] = ["institucional", "erp", "app"];

describe("canonical", () => {
  it("existe em toda rota anunciada em algum sitemap", () => {
    const semCanonical: string[] = [];

    for (const surface of SUPERFICIES) {
      for (const rota of rotasDoSitemap(surface)) {
        const arquivo = arquivoDaRota(surface, rota.path);
        const fonte = fs.readFileSync(arquivo, "utf8");
        if (!fonte.includes("alternates")) {
          semCanonical.push(
            `${surface} ${rota.path} (${path.basename(arquivo)})`,
          );
        }
      }
    }

    expect(semCanonical).toEqual([]);
  });

  it("aponta o page.tsx certo para cada raiz de superfície", () => {
    // Se o mapeamento acima quebrar, o teste de cima passa a ler o arquivo
    // errado e vira um guard que não guarda nada.
    for (const surface of SUPERFICIES) {
      expect(fs.existsSync(arquivoDaRota(surface, "/"))).toBe(true);
    }
  });
});
