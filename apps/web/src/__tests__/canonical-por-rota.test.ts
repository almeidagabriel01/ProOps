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
 * O root layout definia `alternates: { canonical: "/" }`, e em Next isso é
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

/**
 * Onde mora o `page.tsx` que responde por um caminho de uma superfície.
 *
 * A raiz de cada superfície passa pela MESMA busca em route group que o resto:
 * a raiz da institucional é servida de `app/(empresa)/institucional/page.tsx`
 * desde que as cinco páginas do site da empresa passaram a dividir uma casca
 * só, e um resolvedor que só olhasse `app/institucional/` diria que a rota não
 * existe.
 */
function arquivoDaRota(surface: Surface, rota: string): string {
  const caminho =
    rota === "/"
      ? surface === "app"
        ? APP_ROOT
        : surface === "institucional"
          ? INSTITUCIONAL_ROOT
          : "/"
      : rota;

  if (caminho === "/") return path.join(APP_DIR, "page.tsx");

  const direto = path.join(APP_DIR, caminho, "page.tsx");
  if (fs.existsSync(direto)) return direto;

  for (const grupo of gruposDeRota()) {
    const agrupado = path.join(APP_DIR, grupo, caminho, "page.tsx");
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

  it("nunca é relativo, nem o og:url", () => {
    // Relativo, o canonical resolve contra o `metadataBase`, que é o apex. As
    // quatro páginas públicas do ERP declaravam `"/automacao-residencial"` e
    // companhia, e em produção `erp.proops.com.br/automacao-residencial`
    // apontava para `proops.com.br/automacao-residencial`, que devolve 301 para
    // o ERP: um laço, e o Google não indexava nenhuma das duas. O valor certo
    // sai de `canonicalFor`, que conhece o host de cada superfície.
    //
    // O og:url é casado só no primeiro nível do `openGraph` (`[^{}]`): imagem
    // relativa, `images: [{ url: "/opengraph-image.png" }]`, é legítima, porque
    // o arquivo existe nos três hosts.
    const CANONICAL_RELATIVO = /canonical:\s*["'`]\//;
    const OG_URL_RELATIVO = /openGraph:\s*\{[^{}]*?\burl:\s*["'`]\//;

    const arquivos: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.name === "page.tsx" || e.name === "layout.tsx") {
          arquivos.push(full);
        }
      }
    };
    walk(APP_DIR);

    const relativos = arquivos
      .filter((arquivo) => {
        const fonte = fs.readFileSync(arquivo, "utf8");
        return CANONICAL_RELATIVO.test(fonte) || OG_URL_RELATIVO.test(fonte);
      })
      .map((arquivo) => path.relative(APP_DIR, arquivo));

    expect(relativos).toEqual([]);
  });

  it("aponta o page.tsx certo para cada raiz de superfície", () => {
    // Se o mapeamento acima quebrar, o teste de cima passa a ler o arquivo
    // errado e vira um guard que não guarda nada.
    for (const surface of SUPERFICIES) {
      expect(fs.existsSync(arquivoDaRota(surface, "/"))).toBe(true);
    }
  });
});
