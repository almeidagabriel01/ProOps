import type { Page } from "@playwright/test";

/**
 * Junta os erros de hidratação do React que a página emitir, no console ou
 * como exceção. Uma divergência entre o HTML do servidor e o do cliente faz o
 * React redesenhar a seção inteira no primeiro acesso, sem nada quebrar à
 * vista: só este coletor acusa.
 */
export function coletaErrosDeHidratacao(page: Page): string[] {
  const erros: string[] = [];
  const ehHidratacao = (texto: string) => /hydrat|#418|#423|#425/i.test(texto);
  page.on("pageerror", (e) => {
    if (ehHidratacao(e.message)) erros.push(e.message.slice(0, 200));
  });
  page.on("console", (msg) => {
    if (msg.type() === "error" && ehHidratacao(msg.text())) erros.push(msg.text().slice(0, 200));
  });
  return erros;
}
