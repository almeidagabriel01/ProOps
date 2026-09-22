import { describe, expect, it } from "vitest";

import { isSessionlessPage } from "../route-access";

/**
 * A raiz é reescrita por host, e sob rewrite a página vê o caminho do
 * navegador (`/`). Decidir "sem sessão" só pelo caminho punha a raiz da landing
 * do app e, depois da virada, a do site da empresa dentro dos provedores de
 * sessão. No site da empresa isso desmontava o layout ao ir de `/sobre` para
 * `/`, e a cortina de transição ficava parada cobrindo a tela.
 */
describe("isSessionlessPage", () => {
  it("a raiz é sem sessão onde o host não serve o ERP", () => {
    expect(isSessionlessPage("/", "app.proops.com.br")).toBe(true);
    expect(isSessionlessPage("/", "app.localhost:3000")).toBe(true);
    // Depois da virada o apex serve o site da empresa na raiz.
    expect(isSessionlessPage("/", "proops.com.br")).toBe(true);
    expect(isSessionlessPage("/", "www.proops.com.br")).toBe(true);
    expect(isSessionlessPage("/", "proops.localhost:3000")).toBe(true);
  });

  it("a raiz do ERP continua com sessão", () => {
    expect(isSessionlessPage("/", "erp.proops.com.br")).toBe(false);
    expect(isSessionlessPage("/", "localhost:3000")).toBe(false);
    expect(isSessionlessPage("/", "proops-web-git-x.vercel.app")).toBe(false);
  });

  it("no servidor, sem host, a raiz segue a regra antiga", () => {
    expect(isSessionlessPage("/", null)).toBe(false);
  });

  it("as páginas sem sessão continuam sem sessão em qualquer host", () => {
    for (const host of [null, "localhost:3000", "proops.com.br"]) {
      expect(isSessionlessPage("/sobre", host)).toBe(true);
      expect(isSessionlessPage("/aplicativo", host)).toBe(true);
    }
  });

  it("uma rota do ERP nunca vira sem sessão por causa do host", () => {
    expect(isSessionlessPage("/dashboard", "app.proops.com.br")).toBe(false);
    expect(isSessionlessPage("/login", "proops.com.br")).toBe(false);
  });
});
