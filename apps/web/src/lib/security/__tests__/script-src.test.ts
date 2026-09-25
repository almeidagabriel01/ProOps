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
