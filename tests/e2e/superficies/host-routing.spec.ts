/**
 * SUPERFICIES-01: one Next project, three sites, split by hostname.
 *
 * The unit tests in `apps/web/src/lib/site/__tests__` prove the host policy as
 * strings, and `proxy-host-routing.test.ts` proves the proxy's decisions with
 * Next's own testing helpers. Neither exercises the thing that actually breaks
 * in production: a real browser, on a real hostname, receiving a rewritten
 * response and then hydrating it.
 *
 * That gap is not theoretical. The rewrite is deliberately limited to `/`
 * because `providers.tsx` classifies the page with `usePathname()`, which under
 * a rewrite reports the BROWSER path and not the rewrite target. Get that wrong
 * and the proxy lets the page through while the client wraps it in
 * <ProtectedRoute> and bounces it to /login — a failure that only exists once
 * JavaScript runs, so only a browser can catch it.
 *
 * `*.localhost` resolves to 127.0.0.1 in Chromium with no hosts-file edit, and
 * the three hosts are already in `allowedDevOrigins`.
 */

import { test, expect } from "@playwright/test";

/**
 * A porta do servidor de teste, sobreponível.
 *
 * O padrão é a 3001 do `webServer` do Playwright. O override existe para rodar
 * estes dois arquivos contra um `npm run dev` já aberto: as duas páginas são
 * públicas e não tocam em Firebase, então elas não precisam da infraestrutura
 * que o `global-setup` levanta, e exigi-la torna a verificação local cara o
 * bastante para ninguém fazer.
 */
const PORTA = process.env.E2E_PORT ?? 3001;
const APEX = `http://localhost:${PORTA}`;
const APP = `http://app.localhost:${PORTA}`;
const ERP = `http://erp.localhost:${PORTA}`;

/**
 * Busca um arquivo de texto DE DENTRO do host, pelo navegador.
 *
 * O fixture `request` não serve aqui, e a razão não é estilo: ele faz a
 * requisição pelo Node, que no Windows não resolve `*.localhost`
 * (`getaddrinfo ENOTFOUND app.localhost`). O Chromium resolve, internamente, e
 * é por isso que todo `page.goto` deste arquivo funciona enquanto um
 * `request.get` para o MESMO endereço falha. Um `fetch` dentro da página usa a
 * pilha de rede do navegador e some com o problema, além de ser mais fiel: quem
 * lê o robots.txt de um host é um cliente naquele host.
 */
async function buscaNoHost(
  page: import("@playwright/test").Page,
  origem: string,
  caminho: string,
): Promise<string> {
  await page.goto(`${origem}/`);
  return page.evaluate((alvo) => fetch(alvo).then((r) => r.text()), caminho);
}

test.describe("SUPERFICIES-01: host routing", () => {
  test("app.localhost serves the app landing at the root", async ({ page }) => {
    await page.goto(`${APP}/`);

    await expect(page).toHaveTitle(/ProOps Pessoal/);
    // The URL must NOT become /aplicativo: a rewrite is server-side, and a
    // redirect here would mean the host routing turned into navigation.
    expect(new URL(page.url()).pathname).toBe("/");
    await expect(
      page.getByRole("heading", { name: /tela por tela/i }),
    ).toBeAttached();
  });

  test("app landing survives hydration without bouncing to login", async ({
    page,
  }) => {
    await page.goto(`${APP}/`);
    // networkidle, not load: the ProtectedRoute bounce happens after hydration.
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/login");
    expect(page.url()).not.toContain("/auth/refresh");
  });

  test("the apex still serves the ERP, unchanged", async ({ page }) => {
    // The guard that this whole phase is additive. It must keep passing until
    // the cutover flips APEX_SURFACE, and must be updated in the same commit
    // that flips it.
    await page.goto(`${APEX}/`);
    await expect(page).toHaveTitle(/ERP|ProOps/);
    await expect(
      page.getByRole("link", { name: /entrar/i }).first(),
    ).toBeAttached();
  });

  test("erp.localhost serves the ERP route tree as-is", async ({ page }) => {
    await page.goto(`${ERP}/`);
    expect(new URL(page.url()).pathname).toBe("/");
    await expect(
      page.getByRole("link", { name: /entrar/i }).first(),
    ).toBeAttached();
  });

  test("the internal paths stay reachable on any host", async ({ page }) => {
    // Both new pages must remain directly reachable so they can be reviewed
    // from any host while being built.
    await page.goto(`${APEX}/aplicativo`);
    await expect(page).toHaveTitle(/ProOps Pessoal/);

    await page.goto(`${APEX}/institucional`);
    await expect(page).toHaveTitle(/ProOps/);
    expect(page.url()).not.toContain("/login");
  });

  /**
   * As páginas da empresa vivem no NÍVEL do apex, e não debaixo de
   * `/institucional`. Isso é o que faz `proops.com.br/sobre` ser o endereço, e
   * é o que exige que elas estejam em `APEX_COMPANY_PATHS`: sem isso o 301 da
   * virada as manda para um subdomínio que não as serve.
   *
   * O teste que importa aqui é o de HIDRATAÇÃO. As cinco estão em
   * `SESSIONLESS_MARKETING_ROUTES`, ou seja, renderizam fora do `AuthProvider`.
   * Um `useAuth` que entre por um componente compartilhado não é erro de tipo
   * nem falha no servidor: a página responde 200, e só depois de hidratar ela
   * volta para o login. Só um navegador de verdade pega isso.
   */
  test("as páginas da empresa respondem no apex e sobrevivem à hidratação", async ({
    page,
  }) => {
    const paginas = [
      { caminho: "/sobre", titulo: /Sobre a ProOps/ },
      { caminho: "/manifesto", titulo: /Manifesto da ProOps/ },
      { caminho: "/produtos", titulo: /Produtos da ProOps/ },
      { caminho: "/carreiras", titulo: /Carreiras na ProOps/ },
      { caminho: "/fale-conosco", titulo: /Falar com a ProOps/ },
    ];

    for (const pagina of paginas) {
      await page.goto(`${APEX}${pagina.caminho}`);
      await expect(page).toHaveTitle(pagina.titulo);
      // networkidle, e não load: a volta para o login acontece DEPOIS de hidratar.
      await page.waitForLoadState("networkidle");
      expect(new URL(page.url()).pathname).toBe(pagina.caminho);
      expect(page.url()).not.toContain("/login");
      expect(page.url()).not.toContain("/auth/refresh");
    }
  });

  test("robots.txt closes the duplicate hosts and opens the apex", async ({
    page,
  }) => {
    expect(await buscaNoHost(page, APEX, "/robots.txt")).toContain("Allow: /");

    for (const host of [APP, ERP]) {
      const corpo = await buscaNoHost(page, host, "/robots.txt");
      expect(corpo).toContain("Disallow: /\n");
      expect(corpo).not.toContain("Allow: /");
    }
  });

  test("each host publishes its own sitemap", async ({ page }) => {
    const doApp = await buscaNoHost(page, APP, "/sitemap.xml");
    expect(doApp).toContain("<loc>https://app.proops.com.br/</loc>");
    expect(doApp).not.toContain("automacao-residencial");

    const doApex = await buscaNoHost(page, APEX, "/sitemap.xml");
    expect(doApex).toContain("automacao-residencial");
  });
});

test.describe("SUPERFICIES-02: the app landing's own navigation", () => {
  test("every CTA resolves to a section that exists", async ({ page }) => {
    await page.goto(`${APP}/`);

    const alvos = await page
      .locator('a[href^="#"]')
      .evaluateAll((links) =>
        links.map((l) => (l as HTMLAnchorElement).getAttribute("href") ?? ""),
      );

    expect(alvos.length).toBeGreaterThan(0);
    for (const alvo of new Set(alvos)) {
      const id = alvo.slice(1);
      if (!id) continue;
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
  });
});
