import { describe, it, expect } from "vitest";
import { buildScriptSrc } from "../script-src";

describe("buildScriptSrc", () => {
  // Regressão: produção aceitava `https:`, qualquer script de qualquer domínio.
  it("não aceita qualquer domínio HTTPS em produção", () => {
    const tokens = buildScriptSrc(false).split(" ");
    expect(tokens).not.toContain("https:");
    expect(tokens).not.toContain("*");
    expect(tokens).not.toContain("'unsafe-eval'");
    expect(tokens).toContain("'self'");
  });

  it("libera os domínios que o front carrega em produção", () => {
    const value = buildScriptSrc(false);
    for (const origin of [
      "https://www.googletagmanager.com",
      "https://apis.google.com",
      "https://www.gstatic.com",
      "https://challenges.cloudflare.com",
    ]) {
      expect(value).toContain(origin);
    }
  });

  it("mantém o modo de desenvolvimento permissivo (HMR precisa de eval)", () => {
    expect(buildScriptSrc(true)).toContain("'unsafe-eval'");
  });
});

describe("frame-src", () => {
  // Regressão: o Turnstile do cadastro desenha um iframe de
  // challenges.cloudflare.com, e o frame-src não o listava: o script
  // carregava e o widget era bloqueado pela própria CSP.
  it("libera o iframe do Turnstile", async () => {
    const { default: nextConfig } = await import("../../../../next.config");
    const rules = (await nextConfig.headers?.()) ?? [];
    const csp = rules
      .flatMap((rule) => rule.headers)
      .find((header) => header.key === "Content-Security-Policy")?.value;
    const frameSrc = csp?.split(";").find((d) => d.trim().startsWith("frame-src"));
    expect(frameSrc).toContain("https://challenges.cloudflare.com");
  });
});

