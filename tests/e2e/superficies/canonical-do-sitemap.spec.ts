/**
 * Toda URL que um sitemap anuncia responde 200 e se declara canônica.
 *
 * Os testes de unidade provam `canonicalFor` como string e o guard de varredura
 * proíbe canonical relativo no código. Nenhum dos dois olha o HTML servido, que
 * é o que o Google lê. Foi no HTML que o defeito apareceu:
 * `erp.proops.com.br/automacao-residencial` declarava canonical em
 * `proops.com.br/automacao-residencial`, que devolve 301 para o ERP. Um laço,
 * e as quatro páginas públicas do ERP ficaram fora do índice.
 *
 * Os endereços de produção do sitemap são trocados pelos hosts locais
 * equivalentes; o canonical continua sendo comparado com o de produção, porque
 * ele sai de `SITE_URLS`, e não do host que atendeu.
 */

import { test, expect, type Page } from "@playwright/test";

/** Mesma porta sobreponível de `host-routing.spec.ts`. */
const PORTA = process.env.E2E_PORT ?? 3001;

const HOSTS_LOCAIS: Record<string, string> = {
  "proops.com.br": `http://proops.localhost:${PORTA}`,
  "erp.proops.com.br": `http://erp.localhost:${PORTA}`,
  "app.proops.com.br": `http://app.localhost:${PORTA}`,
};

interface Resposta {
  status: number;
  redirecionou: boolean;
  canonical: string | null;
}

/**
 * Busca pelo navegador, de dentro do host, pelo mesmo motivo documentado em
 * `host-routing.spec.ts`: o fixture `request` resolve pelo Node, que no Windows
 * não conhece `*.localhost`.
 */
async function busca(page: Page, url: string): Promise<Resposta> {
  return page.evaluate(async (alvo) => {
    const r = await fetch(alvo);
    const html = await r.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    return {
      status: r.status,
      redirecionou: r.redirected,
      canonical:
        doc.querySelector('link[rel="canonical"]')?.getAttribute("href") ??
        null,
    };
  }, url);
}

/** O Next escreve a raiz sem a barra final; o sitemap, com. */
const semBarraFinal = (url: string) => url.replace(/\/+$/, "");

for (const [hostDeProducao, origemLocal] of Object.entries(HOSTS_LOCAIS)) {
  test(`${hostDeProducao}: cada URL do sitemap é canônica de si mesma`, async ({
    page,
  }) => {
    await page.goto(`${origemLocal}/`);
    const xml = await page.evaluate(() =>
      fetch("/sitemap.xml").then((r) => r.text()),
    );
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(0);

    const problemas: string[] = [];
    for (const url of urls) {
      const destino = new URL(url);
      expect(destino.host, url).toBe(hostDeProducao);

      const local = `${origemLocal}${destino.pathname}`;
      const r = await busca(page, local);

      if (r.status !== 200 || r.redirecionou) {
        problemas.push(`${url}: status ${r.status}, redirect ${r.redirecionou}`);
        continue;
      }
      if (!r.canonical || semBarraFinal(r.canonical) !== semBarraFinal(url)) {
        problemas.push(`${url}: canonical ${r.canonical ?? "ausente"}`);
      }
    }

    expect(problemas).toEqual([]);
  });
}
