import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Rola até uma seção de marketing e espera o JavaScript dela ligar.
 *
 * As seções da landing do aplicativo são montadas por `HidratarPerto`: até
 * chegarem a uma tela e meia da vista, o que está na página é o HTML do
 * servidor, idêntico à vista e sem nada que responda. Uma pessoa nunca alcança
 * esse estado, porque a seção monta antes de aparecer. Um teste alcança, porque
 * ele se teleporta e interage no mesmo instante: o clique cai no HTML que está
 * para ser trocado e se perde, e o teste falha ou, pior, passa por sorte de
 * tempo.
 *
 * `ancora` é qualquer coisa que exista JÁ no HTML do servidor (um `id`, um
 * título). Não use um papel ARIA que a seção só ganha depois de montar, como o
 * `tablist` das horas do "Um dia qualquer": sem montar, ele não existe, e sem
 * achá-lo o teste nunca rola até lá.
 */
export async function secaoViva(page: Page, ancora: string | Locator) {
  const alvo = typeof ancora === "string" ? page.locator(ancora) : ancora;
  await alvo.first().scrollIntoViewIfNeeded();
  await expect(
    page.locator("[data-hidratar-perto][data-vivo]").filter({ has: alvo }),
    "a seção não ligou o JavaScript depois de entrar na margem",
  ).toHaveCount(1);
}
