import {
  ACTIVITY_CATEGORIES,
  TENANT_ACTIVITY_CATALOG,
  TENANT_ACTIVITY_TYPES,
  activityTypesOfCategory,
  isTenantActivityType,
} from "../tenant-activity-catalog";
import { normalizeActivityRoute } from "../activity-route";

describe("catálogo da atividade das empresas", () => {
  it.each(TENANT_ACTIVITY_TYPES)("%s tem categoria válida e rótulo sem travessão", (type) => {
    const def = TENANT_ACTIVITY_CATALOG[type];
    expect(ACTIVITY_CATEGORIES).toContain(def.category);
    expect(def.label.trim().length).toBeGreaterThan(0);
    expect(def.label).not.toMatch(/[—–]/);
  });

  it("a jornada do cadastro à assinatura é gravada pelo servidor, não pelo navegador", () => {
    for (const type of ["signup", "checkout_started", "trial_started", "subscribed", "plan_changed"] as const) {
      expect(TENANT_ACTIVITY_CATALOG[type].client).toBe(false);
    }
  });

  it("o clique em Assinar e os erros vêm do navegador", () => {
    expect(TENANT_ACTIVITY_CATALOG.subscribe_clicked.client).toBe(true);
    expect(TENANT_ACTIVITY_CATALOG.api_error.client).toBe(true);
    expect(TENANT_ACTIVITY_CATALOG.page_view.client).toBe(true);
  });

  it("toda categoria tem ao menos um tipo", () => {
    for (const category of ACTIVITY_CATEGORIES) {
      expect(activityTypesOfCategory(category).length).toBeGreaterThan(0);
    }
  });

  it("isTenantActivityType não aceita chave herdada do protótipo", () => {
    expect(isTenantActivityType("page_view")).toBe(true);
    expect(isTenantActivityType("toString")).toBe(false);
    expect(isTenantActivityType("constructor")).toBe(false);
    expect(isTenantActivityType(42)).toBe(false);
  });
});

describe("normalizeActivityRoute", () => {
  it.each([
    ["/proposals", "/proposals"],
    ["/proposals/aB3dE9fG7hJ2kL1mN0pQ/edit", "/proposals/[id]/edit"],
    ["/transactions?status=paid#top", "/transactions"],
    ["/share/9f1c2b7a-1234-4abc-9def-001122334455", "/share/[id]"],
    ["/clients/12345", "/clients/[id]"],
    ["/automacao-residencial", "/automacao-residencial"],
    ["/settings/linked-accounts", "/settings/linked-accounts"],
    ["/v1/proposals/tenant_abc123", "/v1/proposals/[id]"],
    ["/contatos/joão%20silva", "/contatos/[id]"],
    ["/proposals/", "/proposals"],
    ["/", "/"],
  ])("%s vira %s", (input, expected) => {
    expect(normalizeActivityRoute(input)).toBe(expected);
  });

  it("recusa o que não é caminho", () => {
    expect(normalizeActivityRoute("https://evil.com/x")).toBeNull();
    expect(normalizeActivityRoute(undefined)).toBeNull();
    expect(normalizeActivityRoute("")).toBeNull();
  });

  it("corta em 120 caracteres", () => {
    const long = "/" + Array.from({ length: 40 }, () => "abcde").join("/");
    expect(normalizeActivityRoute(long)!.length).toBeLessThanOrEqual(120);
  });
});
