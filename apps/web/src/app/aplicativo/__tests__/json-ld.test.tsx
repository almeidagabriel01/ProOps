import { describe, expect, it } from "vitest";

import { AplicativoJsonLd } from "../_components/aplicativo-json-ld";
import { InstitucionalJsonLd } from "@/app/(empresa)/institucional/_components/institucional-json-ld";
import { PERGUNTAS } from "../_content/faq";
import { PLANOS } from "../_content/planos";
import { SITE_URLS } from "@/lib/site/surfaces";

/**
 * Structured data is a PUBLIC claim, and the two failure modes here are the
 * expensive kind: a claim that is false, and a claim that is malformed and
 * therefore silently dropped. Neither shows up in the browser.
 *
 * The components are plain server components with no hooks, so calling them as
 * functions and reading the script payload is the whole test: it asserts what
 * ships, not what a renderer might do with it.
 */

interface ElementoScript {
  props: { dangerouslySetInnerHTML: { __html: string } };
}

function payload(elemento: ElementoScript): Record<string, unknown> {
  return JSON.parse(elemento.props.dangerouslySetInnerHTML.__html);
}

/**
 * Os scripts de um componente que devolve mais de um.
 *
 * O do aplicativo publica DUAS entidades sem relação entre si, em `<script>`
 * separados de propósito: num `@graph` único, um erro de sintaxe numa derrubaria
 * a outra junto.
 */
function payloads(elemento: {
  props: { children: ElementoScript[] };
}): Record<string, unknown>[] {
  return elemento.props.children.map(payload);
}

describe("JSON-LD do aplicativo", () => {
  const [data, faq] = payloads(AplicativoJsonLd() as never);

  it("declara um MobileApplication no host do app", () => {
    expect(data["@type"]).toBe("MobileApplication");
    expect(data.url).toBe(`${SITE_URLS.app}/`);
  });

  /**
   * O preço formatado ("R$ 24,90") faz o Google descartar a oferta em silêncio,
   * o que na prática é igual a não ter dado estruturado nenhum. schema.org quer
   * decimal com ponto, e a moeda vai em `priceCurrency`.
   */
  it("publica preço como decimal puro, e igual ao que a tela mostra", () => {
    const offers = data.offers as Array<Record<string, string>>;
    expect(offers).toHaveLength(PLANOS.length);

    offers.forEach((oferta, i) => {
      expect(oferta.name).toBe(PLANOS[i].nome);
      expect(oferta.priceCurrency).toBe("BRL");
      expect(oferta.price).toMatch(/^\d+\.\d{2}$/);
      // o mesmo número, escrito dos dois jeitos
      expect(PLANOS[i].mensal.replace(/[^\d,]/g, "").replace(",", ".")).toBe(
        oferta.price,
      );
    });
  });

  /**
   * Nota inventada em dado estruturado é violação de política do Google, com
   * penalidade manual, e custa os rich results do domínio inteiro. O app não
   * tem avaliação nenhuma.
   */
  it("não inventa avaliação", () => {
    expect(data.aggregateRating).toBeUndefined();
  });

  /**
   * O app não está publicado em loja nenhuma. Um campo de download apontando
   * para uma página que não baixa nada é pior que o campo ausente. Estes dois
   * entram no dia em que os links de loja entrarem.
   */
  it("não promete download enquanto não há loja", () => {
    expect(data.downloadUrl).toBeUndefined();
    expect(data.installUrl).toBeUndefined();
  });

  /**
   * A política do Google exige que a resposta do rich result esteja VISÍVEL na
   * página. As duas superfícies leem o mesmo `_content/faq`, então o que este
   * teste prende é que ninguém escreva um FAQ paralelo aqui dentro: tela e
   * schema divergindo não é inconsistência, é perder o rich result.
   */
  it("publica o FAQ, com as mesmas perguntas que a seção renderiza", () => {
    expect(faq["@type"]).toBe("FAQPage");

    const questoes = faq.mainEntity as Array<{
      "@type": string;
      name: string;
      acceptedAnswer: { "@type": string; text: string };
    }>;

    expect(questoes).toHaveLength(PERGUNTAS.length);
    expect(questoes.map((q) => q.name)).toEqual(
      PERGUNTAS.map((p) => p.pergunta),
    );
    questoes.forEach((questao, i) => {
      expect(questao["@type"]).toBe("Question");
      expect(questao.acceptedAnswer["@type"]).toBe("Answer");
      expect(questao.acceptedAnswer.text).toBe(PERGUNTAS[i].resposta);
      expect(questao.acceptedAnswer.text.length).toBeGreaterThan(0);
    });
  });

  /**
   * `featureList` é descrição pública. Um recurso listado aqui que a página não
   * mostra é a mesma classe de erro que o preço formatado: o cliente encontra
   * antes da gente.
   */
  it("descreve recursos sem prometer o que ainda não existe", () => {
    const features = data.featureList as string[];
    expect(features.length).toBeGreaterThan(0);
    expect(features.join(" ")).not.toMatch(/open finance|conex(ã|a)o banc/i);
  });
});

describe("JSON-LD institucional", () => {
  const data = payload(InstitucionalJsonLd() as never);

  it("é a Organization, ancorada no apex", () => {
    expect(data["@type"]).toBe("Organization");
    expect(String(data.url)).toBe("https://proops.com.br/");
  });

  /**
   * É este campo que diz ao Google que os três domínios são uma empresa só.
   * Sem ele, dividir um domínio em três parece perder um site e ganhar dois
   * desconhecidos.
   */
  it("liga a empresa aos dois produtos, em hosts absolutos", () => {
    const owns = data.owns as Array<Record<string, string>>;
    expect(owns.map((p) => p.url)).toEqual([
      `${SITE_URLS.erp}/`,
      `${SITE_URLS.app}/`,
    ]);
    expect(owns.every((p) => p.url.startsWith("https://"))).toBe(true);
  });

  it("não carrega número que ainda é placeholder", () => {
    expect(data.aggregateRating).toBeUndefined();
    expect(data.numberOfEmployees).toBeUndefined();
    expect(data.foundingDate).toBeUndefined();
  });
});
