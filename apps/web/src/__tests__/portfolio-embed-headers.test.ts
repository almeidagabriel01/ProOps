import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

async function headerRules() {
  const rules = await nextConfig.headers?.();
  if (!rules) throw new Error("Next headers não configurados");
  return rules;
}

function valueOf(headers: { key: string; value: string }[], key: string) {
  return headers.find((header) => header.key === key)?.value;
}

describe("incorporação das landings no portfólio", () => {
  it("libera somente a raiz pública dos dois hosts para a origem do portfólio", async () => {
    const rules = await headerRules();
    const allowed = rules.filter(
      (rule) => (rule.source === "/" || rule.source === "/aplicativo") && rule.has,
    );

    expect(allowed).toHaveLength(3);
    expect(allowed.map((rule) => [rule.source, rule.has?.[0].value])).toEqual([
      ["/", "erp\\.proops\\.com\\.br"],
      ["/", "app\\.proops\\.com\\.br"],
      ["/aplicativo", "1"],
    ]);
    expect(allowed[2].has?.[0]).toMatchObject({
      type: "header",
      key: "x-proops-app-landing-rewrite",
    });
    for (const rule of allowed) {
      expect(valueOf(rule.headers, "Content-Security-Policy")).toContain(
        "frame-ancestors https://www.almeidagabriel.com.br http://localhost:3000 http://127.0.0.1:3000 http://localhost:3001 http://127.0.0.1:3001;",
      );
      expect(valueOf(rule.headers, "X-Frame-Options")).toBeUndefined();
    }
  });

  it("mantém as rotas internas e a raiz dos demais hosts fechadas", async () => {
    const rules = await headerRules();
    const internal = rules.find((rule) => rule.source.includes("(?!aplicativo$)"));
    const appLandingOnOtherHosts = rules.find(
      (rule) => rule.source === "/aplicativo" && rule.missing,
    );
    const otherHome = rules.find((rule) => rule.source === "/" && rule.missing);
    const global = rules.find((rule) => rule.source === "/:path*");

    for (const rule of [internal, appLandingOnOtherHosts, otherHome]) {
      expect(rule).toBeDefined();
      expect(valueOf(rule!.headers, "X-Frame-Options")).toBe("DENY");
      expect(valueOf(rule!.headers, "Content-Security-Policy")).toContain(
        "frame-ancestors 'none'",
      );
    }
    expect(otherHome?.missing?.map((matcher) => matcher.value)).toEqual([
      "erp\\.proops\\.com\\.br",
      "app\\.proops\\.com\\.br",
    ]);
    expect(appLandingOnOtherHosts?.missing?.[0]).toMatchObject({
      type: "header",
      key: "x-proops-app-landing-rewrite",
      value: "1",
    });
    expect(valueOf(global!.headers, "X-Frame-Options")).toBeUndefined();
    expect(valueOf(global!.headers, "Content-Security-Policy")).toBeUndefined();
  });
});
