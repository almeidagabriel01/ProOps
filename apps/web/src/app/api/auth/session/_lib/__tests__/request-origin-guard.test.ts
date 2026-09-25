import { describe, it, expect } from "vitest";
import { checkSessionRequestOrigin } from "../request-origin-guard";

describe("checkSessionRequestOrigin", () => {
  it("aceita o fetch do próprio app", () => {
    expect(
      checkSessionRequestOrigin({ contentType: "application/json", secFetchSite: "same-origin" }),
    ).toBe("ok");
    expect(
      checkSessionRequestOrigin({
        contentType: "application/json; charset=utf-8",
        secFetchSite: null,
      }),
    ).toBe("ok");
  });

  // Regressão: o formulário text/plain de outro site é o vetor do login CSRF.
  it("recusa corpo que não seja JSON declarado", () => {
    expect(
      checkSessionRequestOrigin({ contentType: "text/plain", secFetchSite: "cross-site" }),
    ).toBe("unsupported-media-type");
    expect(
      checkSessionRequestOrigin({
        contentType: "application/x-www-form-urlencoded",
        secFetchSite: null,
      }),
    ).toBe("unsupported-media-type");
    expect(checkSessionRequestOrigin({ contentType: null, secFetchSite: null })).toBe(
      "unsupported-media-type",
    );
  });

  it("recusa chamada de outro site ou de outro subdomínio", () => {
    expect(
      checkSessionRequestOrigin({ contentType: "application/json", secFetchSite: "cross-site" }),
    ).toBe("cross-origin");
    expect(
      checkSessionRequestOrigin({ contentType: "application/json", secFetchSite: "same-site" }),
    ).toBe("cross-origin");
  });
});
