import { describe, expect, it } from "vitest";
import {
  APEX_OWNED_PATHS,
  APEX_STILL_SERVES_ERP,
  APEX_SURFACE,
  apexRedirectPara,
  erpHomeUrlPara,
  resolveApexRedirect,
  APP_ROOT,
  INSTITUCIONAL_ROOT,
  isInternalSurfacePath,
  isNewSubdomainHost,
  normalizeHost,
  resolveRewritePath,
  resolveSurface,
  shouldNoIndexHost,
} from "../surfaces";

describe("resolveSurface", () => {
  it("maps the erp subdomain in production", () => {
    expect(resolveSurface("erp.proops.com.br")).toBe("erp");
  });

  it("maps the app subdomain in production", () => {
    expect(resolveSurface("app.proops.com.br")).toBe("app");
  });

  it("maps the subdomains in local development, port and all", () => {
    // Chrome resolves any *.localhost to 127.0.0.1, so this is the real dev host.
    expect(resolveSurface("erp.localhost:3000")).toBe("erp");
    expect(resolveSurface("app.localhost:3001")).toBe("app");
  });

  it("is case insensitive and tolerates surrounding whitespace", () => {
    expect(resolveSurface("  APP.ProOps.com.BR  ")).toBe("app");
  });

  it("falls back to the apex surface for the apex domain", () => {
    expect(resolveSurface("proops.com.br")).toBe(APEX_SURFACE);
    expect(resolveSurface("www.proops.com.br")).toBe(APEX_SURFACE);
  });

  it("falls back to the apex surface for previews, localhost and a missing header", () => {
    expect(resolveSurface("proops-web-git-feat.vercel.app")).toBe(APEX_SURFACE);
    expect(resolveSurface("localhost:3000")).toBe(APEX_SURFACE);
    expect(resolveSurface(null)).toBe(APEX_SURFACE);
    expect(resolveSurface(undefined)).toBe(APEX_SURFACE);
    expect(resolveSurface("")).toBe(APEX_SURFACE);
  });

  it("does not match a host that merely CONTAINS the label", () => {
    // Regression guard: a substring check would hand these to the wrong site.
    expect(resolveSurface("apps.proops.com.br")).toBe(APEX_SURFACE);
    expect(resolveSurface("erpx.proops.com.br")).toBe(APEX_SURFACE);
    expect(resolveSurface("meu-app.proops.com.br")).toBe(APEX_SURFACE);
  });
});

describe("resolveRewritePath", () => {
  it("never rewrites the ERP surface — its tree is served exactly as today", () => {
    for (const path of ["/", "/login", "/dashboard", "/contato", "/agendar"]) {
      expect(resolveRewritePath("erp", path)).toBeNull();
    }
  });

  it("rewrites the root of each new surface to its own page", () => {
    expect(resolveRewritePath("app", "/")).toBe(APP_ROOT);
    expect(resolveRewritePath("institucional", "/")).toBe(INSTITUCIONAL_ROOT);
  });

  it("rewrites ONLY the root, on every surface", () => {
    // Rewriting a subtree would desync the proxy from providers.tsx, which
    // classifies with usePathname() and therefore sees the browser path.
    for (const surface of ["app", "institucional"] as const) {
      for (const path of ["/login", "/dashboard", "/privacidade", "/sobre"]) {
        expect(resolveRewritePath(surface, path)).toBeNull();
      }
    }
  });

  it("does not re-enter the subtree it just rewrote into", () => {
    expect(resolveRewritePath("app", APP_ROOT)).toBeNull();
    expect(resolveRewritePath("institucional", INSTITUCIONAL_ROOT)).toBeNull();
  });
});

describe("indexabilidade por host", () => {
  /**
   * O caso que motivou `isNewSubdomainHost`.
   *
   * `resolveSurface` mapeia o apex E `erp.proops.com.br` para a superfície
   * "erp", corretamente: os dois renderizam a mesma coisa hoje. Só que a
   * pergunta "estes dois são a mesma página em dois endereços?" não pode ser
   * feita à superfície, porque a resposta dela é "é a mesma superfície", que é
   * justamente o contrário do que se quer saber. Enquanto ela era feita assim,
   * a duplicata ficava indexável.
   */
  it("reconhece os subdomínios novos, inclusive o que compartilha superfície com o apex", () => {
    expect(isNewSubdomainHost("erp.proops.com.br")).toBe(true);
    expect(isNewSubdomainHost("app.proops.com.br")).toBe(true);
    expect(isNewSubdomainHost("proops.com.br")).toBe(false);
    expect(isNewSubdomainHost("www.proops.com.br")).toBe(false);
    expect(isNewSubdomainHost("proops-git-branch.vercel.app")).toBe(false);
    expect(isNewSubdomainHost(null)).toBe(false);
  });

  it("normaliza porta, cadeia encaminhada e colchetes de IPv6", () => {
    expect(isNewSubdomainHost("erp.localhost:3000")).toBe(true);
    expect(isNewSubdomainHost("  APP.ProOps.com.BR  ")).toBe(true);
    expect(isNewSubdomainHost("app.proops.com.br, vercel.internal")).toBe(true);
    expect(normalizeHost("erp.proops.com.br:8443")).toBe("erp.proops.com.br");
  });

  /**
   * Host IPv6 não é desmontado de verdade: `\]$` só casa colchete no FIM da
   * string, e o `split(":")` seguinte corta o endereço inteiro, então o
   * resultado é vazio. Fica registrado porque o desfecho é o certo por acidente
   * e alguém pode "consertar" a normalização sem perceber: label vazio não é
   * "app" nem "erp", então a requisição cai no apex, que é o padrão seguro.
   */
  it("degrada um host IPv6 para o apex, em vez de adivinhar", () => {
    expect(normalizeHost("[::1]:3000")).toBe("");
    expect(resolveSurface("[::1]:3000")).toBe(APEX_SURFACE);
    expect(isNewSubdomainHost("[::1]:3000")).toBe(false);
  });

  it("mantém os dois subdomínios fora do índice enquanto o apex serve o ERP", () => {
    expect(APEX_STILL_SERVES_ERP).toBe(true);
    expect(shouldNoIndexHost("erp.proops.com.br")).toBe(true);
    expect(shouldNoIndexHost("app.proops.com.br")).toBe(true);
    expect(shouldNoIndexHost("proops.com.br")).toBe(false);
  });
});

/**
 * A virada (fase 9), exercitada dos DOIS lados.
 *
 * O valor destes testes não é o estado de hoje, em que a regra não faz nada: é
 * provar o comportamento de depois do flip antes de ele acontecer. Sem isso, a
 * primeira execução da regra de 301 seria em produção, no dia mais arriscado do
 * plano, e um erro ali é permanente por definição.
 */
describe("a virada do apex", () => {
  const DEPOIS = {
    apexServeErp: false,
    superficieDoApex: "institucional" as const,
    superficie: "institucional" as const,
  };

  it("hoje não redireciona nada", () => {
    expect(APEX_STILL_SERVES_ERP).toBe(true);
    for (const p of ["/", "/login", "/dashboard", "/privacy", "/decoracao"]) {
      expect(resolveApexRedirect("erp", p)).toBeNull();
    }
  });

  it("depois manda todo caminho do ERP para o subdomínio", () => {
    expect(apexRedirectPara("/login", DEPOIS)).toBe(
      "https://erp.proops.com.br/login",
    );
    expect(apexRedirectPara("/dashboard", DEPOIS)).toBe(
      "https://erp.proops.com.br/dashboard",
    );
    expect(apexRedirectPara("/automacao-residencial", DEPOIS)).toBe(
      "https://erp.proops.com.br/automacao-residencial",
    );
  });

  /**
   * A raiz é a exceção que não tem conserto, e é o risco declarado do plano: ela
   * continua respondendo 200 com outro conteúdo, e nenhum 301 expressa isso. Um
   * redirect aqui levaria a institucional inteira para o ERP.
   */
  it("depois NÃO redireciona a raiz", () => {
    expect(apexRedirectPara("/", DEPOIS)).toBeNull();
  });

  it("depois mantém as páginas legais no apex, que é onde o canonical delas aponta", () => {
    for (const p of APEX_OWNED_PATHS) {
      expect(apexRedirectPara(p, DEPOIS)).toBeNull();
    }
  });

  it("não mexe em quem chega pelos subdomínios", () => {
    for (const superficie of ["erp", "app"] as const) {
      expect(apexRedirectPara("/login", { ...DEPOIS, superficie })).toBeNull();
    }
  });

  /**
   * O destino do usuário free tem que acompanhar o ERP. Escrito como "/", ele
   * larga a pessoa na página da empresa depois da virada: sem login, sem planos
   * e sem nada para clicar.
   */
  it("leva o usuário free para a landing do ERP nos dois estados", () => {
    expect(erpHomeUrlPara(true)).toBe("/");
    expect(erpHomeUrlPara(false)).toBe("https://erp.proops.com.br/");
  });
});

/**
 * Os caminhos internos não são endereço público.
 *
 * `app.proops.com.br/` e `/aplicativo` renderizam a mesma página. Os dois
 * continuam alcançáveis de propósito, para revisar de qualquer host, mas
 * indexar o caminho publicaria cada página em dois endereços desde o primeiro
 * dia. Descoberto ao mapear o que um merge para main publicaria: as duas
 * respondiam 200 no apex, sem noindex e sem bloqueio no robots.
 */
describe("caminhos internos das superfícies", () => {
  it("reconhece os dois, e a subárvore de cada um", () => {
    expect(isInternalSurfacePath("/aplicativo")).toBe(true);
    expect(isInternalSurfacePath("/institucional")).toBe(true);
    expect(isInternalSurfacePath("/aplicativo/qualquer")).toBe(true);
  });

  it("não confunde com uma rota que só começa igual", () => {
    expect(isInternalSurfacePath("/aplicativos")).toBe(false);
    expect(isInternalSurfacePath("/")).toBe(false);
    expect(isInternalSurfacePath("/decoracao")).toBe(false);
  });
});
