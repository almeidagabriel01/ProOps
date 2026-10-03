import { test, expect } from "@playwright/test";
import { coletaErrosDeHidratacao } from "../helpers/erros-de-hidratacao";
import { FUNCIONALIDADE_SLUGS } from "../../../apps/web/src/lib/landing/funcionalidades/slugs";

/**
 * FUNCIONALIDADES: a seção da home, a página com todas em cards e a página de
 * cada uma.
 *
 * O conteúdo (qual recurso pertence a qual funcionalidade, os selos de plano,
 * os prints) tem testes de unidade em `apps/web/src/lib/landing`. Aqui o que
 * se mede é o que só um navegador vê: a navbar rola até a seção da home em vez
 * de abrir outra página, cada item e cada card levam à página certa (o card
 * inteiro é clicável), o print de verdade aparece no topo da página, um slug
 * inventado é 404 e nada disso tem erro de hidratação.
 */

// Da lista de slugs, que é a fonte da página: funcionalidade nova não pede
// para lembrar de atualizar um número aqui.
const TOTAL_DE_FUNCIONALIDADES = FUNCIONALIDADE_SLUGS.length;

test.describe("FUNCIONALIDADES: a seção da home", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("'Funcionalidades' na navbar rola até a seção, sem sair da home", async ({ page }) => {
    await page.goto("/");
    const link = page.getByRole("navigation").getByRole("link", { name: "Funcionalidades", exact: true }).first();
    await expect(link).toHaveAttribute("href", "#recursos");
    // A pílula do centro aparece com a rolagem.
    await page.mouse.wheel(0, 600);
    await link.click();
    await expect(page).toHaveURL(/\/#recursos$/);
    await expect(page.locator("#recursos")).toBeInViewport();
  });

  // O Lenis nasce num requestIdleCallback. Num runner lento o clique chegava
  // antes dele: a rolagem começava nativa, o Lenis nascia no meio dela, fixava
  // a página onde estava e a seção nunca entrava na tela. Aqui o idle fica
  // preso até depois do clique, para o atraso deixar de ser sorte.
  test("o clique antes de o Lenis nascer ainda chega à seção", async ({ page }) => {
    await page.addInitScript(() => {
      const fila: Array<() => void> = [];
      const original = window.requestIdleCallback.bind(window);
      let solto = false;
      window.requestIdleCallback = ((cb: IdleRequestCallback, opts?: IdleRequestOptions) => {
        if (solto) return original(cb, opts);
        fila.push(() => original(cb, opts));
        return 0;
      }) as typeof window.requestIdleCallback;
      (window as unknown as { __soltarIdle: () => void }).__soltarIdle = () => {
        solto = true;
        fila.splice(0).forEach((agendar) => agendar());
      };
    });
    await page.goto("/");
    const link = page.getByRole("navigation").getByRole("link", { name: "Funcionalidades", exact: true }).first();
    await page.mouse.wheel(0, 600);
    await link.click();
    await page.evaluate(() => (window as unknown as { __soltarIdle: () => void }).__soltarIdle());
    await expect(page).toHaveURL(/\/#recursos$/);
    await expect(page.locator("#recursos")).toBeInViewport();
  });

  test("cita cinco funcionalidades, cada uma levando à página dela", async ({ page }) => {
    await page.goto("/");
    const recursos = page.locator("#recursos");
    await recursos.scrollIntoViewIfNeeded();
    await expect(recursos.locator('ol a[href^="/funcionalidades/"]')).toHaveCount(5);
    await recursos.getByRole("link", { name: /^Pós-venda por link/ }).click();
    await expect(page).toHaveURL(/\/funcionalidades\/pos-venda$/);
  });

  test("'Ver todas as funcionalidades' abre a página com todas", async ({ page }) => {
    await page.goto("/");
    await page.locator("#recursos").getByRole("link", { name: "Ver todas as funcionalidades" }).click();
    await expect(page).toHaveURL(/\/funcionalidades$/);
  });
});

test.describe("FUNCIONALIDADES: a página com todas", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("um card por funcionalidade, cada um com o print da tela e o plano", async ({ page }) => {
    await page.goto("/funcionalidades");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Tudo o que a ProOps faz");
    const cards = page.locator("main li").filter({ has: page.locator('a[href^="/funcionalidades/"]') });
    await expect(cards).toHaveCount(TOTAL_DE_FUNCIONALIDADES);
    const semPrint = await cards.evaluateAll((els) =>
      els.filter((el) => !el.querySelector('img[src*="capturas"], img[srcset*="capturas"]')).length,
    );
    expect(semPrint).toBe(0);
    const semPlano = await cards.evaluateAll((els) =>
      els.filter((el) => !/plano|Profissional|Enterprise|Starter/.test(el.textContent ?? "")).length,
    );
    expect(semPlano).toBe(0);
  });

  test("clicar no card, fora do título, abre a página da funcionalidade", async ({ page }) => {
    await page.goto("/funcionalidades");
    const card = page.locator("main li").filter({ has: page.getByRole("link", { name: "Financeiro", exact: true }) });
    // O título cobre o card com um ::after, então é ele que recebe o clique
    // dado sobre a explicação; `force` pula a checagem de alvo do Playwright,
    // que esperaria o próprio parágrafo receber o evento.
    await card.getByText("Você só dá baixa").click({ force: true });
    await expect(page).toHaveURL(/\/funcionalidades\/financeiro$/);
  });
});

test.describe("FUNCIONALIDADES: a página de cada uma", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("abre com o nome, o print de verdade e os recursos incluídos", async ({ page }) => {
    await page.goto("/funcionalidades/financeiro");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Financeiro");
    const print = page.getByRole("img", { name: /Lançamentos da ProOps/ });
    await expect(print).toBeVisible();
    expect(await print.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(page.getByRole("heading", { name: /Como funciona/ })).toBeVisible();
    for (const id of ["lancamentos", "carteiras", "comissoes", "painel"]) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
    await expect(page.locator("#lancamentos")).toContainText("Profissional");
    // O primeiro é o do topo da página; o rodapé também tem um.
    await page.getByRole("link", { name: "Todas as funcionalidades", exact: true }).first().click();
    await expect(page).toHaveURL(/\/funcionalidades$/);
  });

  test("os exemplos abertos aparecem na página que os reúne", async ({ page }) => {
    await page.goto("/funcionalidades/pos-venda");
    await expect(
      page.locator("#portal-do-cliente").getByRole("link", { name: "Abrir o portal de exemplo" }),
    ).toHaveAttribute("href", "/share/portal/exemplo");
    await page.goto("/funcionalidades/fluxo-de-caixa-e-dre");
    await expect(
      page.locator("#link-do-contador").getByRole("link", { name: "Abrir o acesso de exemplo" }),
    ).toHaveAttribute("href", "/share/contador/exemplo");
  });

  test("slug fora da lista é 404", async ({ page }) => {
    const resposta = await page.goto("/funcionalidades/nao-existe");
    expect(resposta?.status()).toBe(404);
  });

  test("o bloco da plataforma numa landing de nicho abre a mesma página", async ({ page }) => {
    await page.goto("/decoracao");
    await page.getByRole("link", { name: "Saiba mais: O financeiro nasce da venda" }).click();
    await expect(page).toHaveURL(/\/funcionalidades\/financeiro$/);
  });
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test.describe(`FUNCIONALIDADES: hidratação (${reducedMotion})`, () => {
    test.use({ viewport: { width: 1280, height: 800 }, contextOptions: { reducedMotion } });

    for (const rota of ["/funcionalidades", "/funcionalidades/lia", "/funcionalidades/aceite-online"]) {
      test(`${rota} sem erro de hidratação`, async ({ page }) => {
        const erros = coletaErrosDeHidratacao(page);
        await page.goto(rota);
        await page.waitForLoadState("networkidle");
        await page.mouse.wheel(0, 1600);
        await page.waitForTimeout(800);
        expect(erros).toEqual([]);
      });
    }
  });
}
