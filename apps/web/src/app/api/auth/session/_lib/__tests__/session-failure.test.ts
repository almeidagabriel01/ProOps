import { describe, it, expect } from "vitest";
import { shouldCountSessionFailure } from "../session-failure";

const err = (code?: string) => Object.assign(new Error("x"), code ? { code } : {});

describe("shouldCountSessionFailure", () => {
  it("conta corpo inválido", () => {
    expect(shouldCountSessionFailure("request", new SyntaxError("bad json"))).toBe(true);
  });

  it("conta token forjado ou malformado", () => {
    expect(shouldCountSessionFailure("verify-token", err("auth/argument-error"))).toBe(true);
    expect(shouldCountSessionFailure("verify-token", err("auth/invalid-id-token"))).toBe(true);
    expect(shouldCountSessionFailure("verify-token", err())).toBe(true);
  });

  // Regressão: re-sync em segundo plano com token velho contava como ataque
  // e, somado às tentativas do interstitial, bloqueava o IP do escritório.
  it("não conta token expirado ou revogado (re-sync legítimo)", () => {
    expect(shouldCountSessionFailure("verify-token", err("auth/id-token-expired"))).toBe(false);
    expect(shouldCountSessionFailure("verify-token", err("auth/id-token-revoked"))).toBe(false);
    expect(shouldCountSessionFailure("verify-token", err("auth/user-disabled"))).toBe(false);
  });

  it("não conta erro de infraestrutura do Firebase", () => {
    expect(shouldCountSessionFailure("verify-token", err("auth/internal-error"))).toBe(false);
    expect(shouldCountSessionFailure("verify-token", err("app/network-error"))).toBe(false);
  });

  it("não conta falha depois de o token ter sido aceito", () => {
    expect(shouldCountSessionFailure("after-verify", err("auth/argument-error"))).toBe(false);
  });
});
