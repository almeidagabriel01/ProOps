import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { InstitucionalJsonLd } from "@/app/(empresa)/institucional/_components/institucional-json-ld";
import { AplicativoJsonLd } from "@/app/aplicativo/_components/aplicativo-json-ld";
import {
  ORGANIZACAO_ID,
  SoftwareApplicationJsonLd,
  WebSiteJsonLd,
} from "@/components/seo/json-ld";
import { APEX_URL, SITE_URLS } from "@/lib/site/surfaces";

/**
 * O dado estruturado dos três sites, lido como o Google lê: o JSON de cada
 * `<script type="application/ld+json">`.
 *
 * Cobre três defeitos que estavam publicados: uma `SearchAction` para uma busca
 * que não existe (o Google rastreava a URL do modelo, `?q={search_term_string}`),
 * uma nota de 4,8 com 50 avaliações que ninguém deu, e o nome "ProOps" preso ao
 * `WebSite` do ERP em vez do apex.
 */

type No = Record<string, unknown>;

function blocos(elemento: ReactElement): No[] {
  const html = renderToStaticMarkup(elemento);
  const scripts = [
    ...html.matchAll(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
    ),
  ];
  return scripts.map((m) => JSON.parse(m[1]) as No);
}

/** Todo nó, achatando `@graph`. */
function nos(elemento: ReactElement): No[] {
  return blocos(elemento).flatMap((bloco) =>
    Array.isArray(bloco["@graph"]) ? (bloco["@graph"] as No[]) : [bloco],
  );
}

const TODOS: Array<[string, ReactElement]> = [
  ["institucional", <InstitucionalJsonLd key="i" />],
  ["erp: site", <WebSiteJsonLd key="w" />],
  ["erp: aplicação", <SoftwareApplicationJsonLd key="s" />],
  [
    "erp: nicho",
    <SoftwareApplicationJsonLd key="n" niche="automacao_residencial" />,
  ],
  ["app", <AplicativoJsonLd key="a" />],
];

describe("dado estruturado", () => {
  it.each(TODOS)("%s não declara busca interna", (_, elemento) => {
    const html = renderToStaticMarkup(elemento);
    expect(html).not.toContain("SearchAction");
    expect(html).not.toContain("search_term_string");
  });

  it.each(TODOS)("%s não publica nota de avaliação", (_, elemento) => {
    expect(renderToStaticMarkup(elemento)).not.toContain("aggregateRating");
  });

  it("o apex é o site chamado ProOps, publicado pela empresa", () => {
    const todos = nos(<InstitucionalJsonLd />);
    const site = todos.find((n) => n["@type"] === "WebSite");
    const empresa = todos.find((n) => n["@type"] === "Organization");

    expect(site).toMatchObject({
      name: "ProOps",
      url: `${APEX_URL}/`,
      publisher: { "@id": ORGANIZACAO_ID },
    });
    expect(empresa).toMatchObject({ "@id": ORGANIZACAO_ID, url: `${APEX_URL}/` });
  });

  it("a empresa declara os dois produtos pelos seus hosts", () => {
    const empresa = nos(<InstitucionalJsonLd />).find(
      (n) => n["@type"] === "Organization",
    );
    const urls = (empresa?.owns as No[]).map((p) => p.url);
    expect(urls).toEqual([`${SITE_URLS.erp}/`, `${SITE_URLS.app}/`]);
  });

  it("o site do ERP tem nome próprio e aponta para a mesma empresa", () => {
    const [site] = nos(<WebSiteJsonLd />);
    expect(site.name).toBe("ProOps ERP");
    expect(site.url).toBe(`${SITE_URLS.erp}/`);
    expect(site.publisher).toMatchObject({
      "@id": ORGANIZACAO_ID,
      name: "ProOps",
    });
  });

  it("o aplicativo aponta para a mesma empresa", () => {
    const [aplicativo] = nos(<AplicativoJsonLd />);
    expect(aplicativo.publisher).toMatchObject({ "@id": ORGANIZACAO_ID });
  });

  it("só o apex declara uma Organization completa", () => {
    for (const [nome, elemento] of TODOS) {
      if (nome === "institucional") continue;
      const organizacoes = nos(elemento).filter(
        (n) => n["@type"] === "Organization",
      );
      expect(organizacoes, nome).toEqual([]);
    }
  });
});
