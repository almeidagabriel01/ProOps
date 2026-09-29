import { describe, expect, it } from "vitest";
import { anchorHref } from "@/lib/landing/anchor-href";

describe("anchorHref", () => {
  it("na home, a âncora continua na própria página", () => {
    expect(anchorHref("#pricing", "/")).toBe("#pricing");
  });

  it.each(["/decoracao", "/funcionalidades", "/marcenaria", null])(
    "fora da home (%s), a âncora leva para a seção da home",
    (pathname) => {
      expect(anchorHref("#pricing", pathname)).toBe("/#pricing");
      expect(anchorHref("#recursos", pathname)).toBe("/#recursos");
    },
  );

  it("link de rota passa intacto", () => {
    expect(anchorHref("/funcionalidades", "/decoracao")).toBe("/funcionalidades");
    expect(anchorHref("/funcionalidades", "/")).toBe("/funcionalidades");
  });
});
