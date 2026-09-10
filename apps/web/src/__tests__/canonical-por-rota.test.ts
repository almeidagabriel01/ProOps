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

/**
 * Os route groups de primeiro nível, `(nome)`, que não entram na URL.
 *
 * Sem isto o resolvedor procura `app/sobre/page.tsx` e não acha
 * `app/(empresa)/sobre/page.tsx`. Lido do disco em vez de escrito à mão para
 * que um grupo novo não precise ser cadastrado aqui: a falha seria um
 * `ENOENT` num teste de canonical, que não parece o que é.
 */
function gruposDeRota(): string[] {
  return fs
    .readdirSync(APP_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith("("))
    .map((e) => e.name);
}

/** Onde mora o `page.tsx` que responde por um caminho de uma superfície. */
function arquivoDaRota(surface: Surface, rota: string): string {
  if (rota === "/") {
    if (surface === "app") return path.join(APP_DIR, APP_ROOT, "page.tsx");
    if (surface === "institucional") {
      return path.join(APP_DIR, INSTITUCIONAL_ROOT, "page.tsx");
    }
    return path.join(APP_DIR, "page.tsx");
  }

  const direto = path.join(APP_DIR, rota, "page.tsx");
  if (fs.existsSync(direto)) return direto;

  for (const grupo of gruposDeRota()) {
    const agrupado = path.join(APP_DIR, grupo, rota, "page.tsx");
    if (fs.existsSync(agrupado)) return agrupado;
  }

  // Devolve o caminho direto para o erro nomear o arquivo que FALTA, em vez de
  // o último grupo que por acaso foi tentado.
  return direto;
}

const SUPERFICIES: Surface[] = ["institucional", "erp", "app"];

describe("canonical", () => {
  it("existe em toda rota anunciada em algum sitemap", () => {
    const semCanonical: string[] = [];

    for (const surface of SUPERFICIES) {
      for (const rota of rotasDoSitemap(surface)) {
        const arquivo = arquivoDaRota(surface, rota.path);
        if (!fs.existsSync(arquivo)) {
          semCanonical.push(
            `${surface} ${rota.path} (sem page.tsx em ${path.relative(APP_DIR, arquivo)})`,
          );
          continue;
        }
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
