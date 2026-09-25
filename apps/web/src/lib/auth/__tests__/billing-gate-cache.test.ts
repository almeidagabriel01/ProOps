/**
 * Cache do gate de billing no proxy. Guarda só estado que deu acesso, e só o
 * usa quando ele volta a dar acesso para o caminho pedido; toda negação é
 * confirmada pela rota. Isso cobre pagante, conta free (allowlist), bloqueado,
 * em carência e superadmin.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  BILLING_GATE_CACHE_TTL_MS,
  clearBillingGateCacheForTest,
  hashSessionCookie,
  isAllowedFromCache,
  rememberAllowedSnapshot,
} from "../billing-gate-cache";

const NOW = Date.parse("2026-09-24T12:00:00Z");

beforeEach(() => clearBillingGateCacheForTest());

describe("billing gate cache", () => {
  it("sem entrada, consulta a rota", () => {
    expect(isAllowedFromCache("k", "/dashboard", NOW)).toBe(false);
  });

  it("pagante ativo: libera outras rotas do ERP pelo cache", () => {
    rememberAllowedSnapshot("k", { role: "master", subscriptionStatus: "active", pastDueSince: null }, NOW);
    expect(isAllowedFromCache("k", "/products", NOW + 1000)).toBe(true);
    expect(isAllowedFromCache("k", "/transactions", NOW + 1000)).toBe(true);
  });

  it("expira depois do TTL", () => {
    rememberAllowedSnapshot("k", { role: "master", subscriptionStatus: "active", pastDueSince: null }, NOW);
    expect(isAllowedFromCache("k", "/products", NOW + BILLING_GATE_CACHE_TTL_MS + 1)).toBe(false);
  });

  it("conta free: caminho fora da allowlist volta para a rota (não é liberado pelo cache)", () => {
    rememberAllowedSnapshot("k", { role: "free", subscriptionStatus: "", pastDueSince: null }, NOW);
    expect(isAllowedFromCache("k", "/admin", NOW)).toBe(false);
  });

  it("carência que venceu dentro da janela deixa de liberar pelo cache", () => {
    const pastDueSince = new Date(NOW - 7 * 24 * 3600 * 1000 + 5000).toISOString();
    rememberAllowedSnapshot("k", { role: "master", subscriptionStatus: "past_due", pastDueSince }, NOW);
    expect(isAllowedFromCache("k", "/products", NOW)).toBe(true);
    expect(isAllowedFromCache("k", "/products", NOW + 10_000)).toBe(false);
  });

  it("superadmin (bypass) libera qualquer caminho", () => {
    rememberAllowedSnapshot("k", { bypass: true }, NOW);
    expect(isAllowedFromCache("k", "/qualquer", NOW)).toBe(true);
  });

  it("resposta sem snapshot (ex.: sem tenant) não é guardada", () => {
    rememberAllowedSnapshot("k", undefined, NOW);
    expect(isAllowedFromCache("k", "/dashboard", NOW)).toBe(false);
  });

  it("sessões diferentes não compartilham entrada", async () => {
    const a = await hashSessionCookie("cookie-a");
    const b = await hashSessionCookie("cookie-b");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    rememberAllowedSnapshot(a, { role: "master", subscriptionStatus: "active", pastDueSince: null }, NOW);
    expect(isAllowedFromCache(b, "/dashboard", NOW)).toBe(false);
  });
});
