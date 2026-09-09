/**
 * "Já existe um gatilho para este evento, empresa e url" é o provedor dizendo
 * que o estado desejado JÁ FOI alcançado — não que falhou.
 *
 * Tratar como erro mostrava "Notificação automática não registrada" sobre uma
 * integração funcionando, com um botão "Tentar de novo" que nunca ia resolver:
 * cada tentativa recria a mesma duplicata e recebe a mesma recusa.
 */

import { isDuplicateWebhookError } from "./fiscal-webhook-registration.service";

describe("isDuplicateWebhookError", () => {
  it("reconhece a mensagem do Focus, com acento", () => {
    expect(
      isDuplicateWebhookError({
        message: "Já existe um gatilho para este evento, empresa e url",
      }),
    ).toBe(true);
  });

  it("reconhece sem acento — a acentuação varia entre respostas", () => {
    expect(
      isDuplicateWebhookError({ message: "Ja existe um gatilho para este evento" }),
    ).toBe(true);
  });

  it("reconhece a variante em inglês", () => {
    expect(isDuplicateWebhookError({ message: "Hook already exists" })).toBe(true);
  });

  it("olha também o código, com separador — defensivo", () => {
    // Só a mensagem foi observada de fato; o formato do código não. A
    // normalização de `_`/`-` cobre o caso sem depender de um valor inventado.
    expect(isDuplicateWebhookError({ codigo: "ja_existe" })).toBe(true);
    expect(isDuplicateWebhookError({ codigo: "already-exists" })).toBe(true);
  });

  it("não confunde com falha de verdade", () => {
    // Token inválido e URL recusada precisam continuar aparecendo na tela.
    expect(isDuplicateWebhookError({ message: "Token inválido" })).toBe(false);
    expect(isDuplicateWebhookError({ message: "URL inacessível" })).toBe(false);
    expect(isDuplicateWebhookError({})).toBe(false);
  });
});
