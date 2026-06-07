import { describe, it, expect } from "vitest";
import { shouldAcceptLegacyAuthCookie } from "../legacy-auth-cookie";

const LOOPBACK = "localhost:3000";

describe("shouldAcceptLegacyAuthCookie", () => {
  it("aceita apenas com NODE_ENV=development explícito + host loopback", () => {
    expect(
      shouldAcceptLegacyAuthCookie({
        host: LOOPBACK,
        env: { NODE_ENV: "development" },
      }),
    ).toBe(true);
    expect(
      shouldAcceptLegacyAuthCookie({
        host: "127.0.0.1",
        env: { NODE_ENV: "development" },
      }),
    ).toBe(true);
  });

  it("fail-closed quando NODE_ENV não é development explícito (ausente/production/test)", () => {
    expect(shouldAcceptLegacyAuthCookie({ host: LOOPBACK, env: {} })).toBe(false);
    expect(
      shouldAcceptLegacyAuthCookie({ host: LOOPBACK, env: { NODE_ENV: "production" } }),
    ).toBe(false);
    expect(
      shouldAcceptLegacyAuthCookie({ host: LOOPBACK, env: { NODE_ENV: "test" } }),
    ).toBe(false);
    // Comparação case-insensitive: só "development" exato (após lower) autoriza.
    expect(
      shouldAcceptLegacyAuthCookie({ host: LOOPBACK, env: { NODE_ENV: "dev" } }),
    ).toBe(false);
  });

  it("host ausente → recusa, mesmo em development (fail-closed estrito)", () => {
    expect(
      shouldAcceptLegacyAuthCookie({ env: { NODE_ENV: "development" } }),
    ).toBe(false);
    expect(
      shouldAcceptLegacyAuthCookie({ host: null, env: { NODE_ENV: "development" } }),
    ).toBe(false);
    expect(shouldAcceptLegacyAuthCookie()).toBe(false);
  });

  it("host não-loopback → recusa, mesmo em development", () => {
    expect(
      shouldAcceptLegacyAuthCookie({
        host: "app.proops.com.br",
        env: { NODE_ENV: "development" },
      }),
    ).toBe(false);
    expect(
      shouldAcceptLegacyAuthCookie({
        host: "evil.com",
        env: { NODE_ENV: "development" },
      }),
    ).toBe(false);
  });

  it("invariante: nenhum input do cliente (Host) autoriza sozinho", () => {
    // Host loopback spoofado SEM NODE_ENV=development → recusa.
    expect(shouldAcceptLegacyAuthCookie({ host: "localhost", env: {} })).toBe(false);
    expect(
      shouldAcceptLegacyAuthCookie({
        host: "localhost",
        env: { NODE_ENV: "production" },
      }),
    ).toBe(false);
  });

  it("opt-out via AUTH_ACCEPT_LEGACY_COOKIE_HINT=false continua valendo (usado no E2E)", () => {
    expect(
      shouldAcceptLegacyAuthCookie({
        host: LOOPBACK,
        env: { NODE_ENV: "development", AUTH_ACCEPT_LEGACY_COOKIE_HINT: "false" },
      }),
    ).toBe(false);
  });
});
