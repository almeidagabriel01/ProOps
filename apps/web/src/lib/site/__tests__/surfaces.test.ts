import { describe, expect, it } from "vitest";
import {
  APEX_STILL_SERVES_ERP,
  APEX_SURFACE,
  APP_ROOT,
  INSTITUCIONAL_ROOT,
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
