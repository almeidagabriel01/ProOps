import { describe, it, expect } from "vitest";
import { getPageConfig, pageIsMasterOnly, PAGE_CONFIG } from "../page-config";
import { PERMISSION_PAGES } from "../permissions/pages";

/**
 * Regression: the Settings tabs (Equipe / Verificação em dois fatores /
 * Pagamento Online) must be reachable by any authenticated user so the
 * in-page "Acesso Restrito" message shows for members instead of bouncing
 * them to /403. protected-route.tsx redirects to /403 when a route is
 * `masterOnly` OR has a `requiredPermission` the user lacks — so these
 * sub-routes must have neither.
 */
describe("settings sub-tab page configs", () => {
  const SUBTABS = [
    // A raiz entra junto: é o item "Configurações" do menu do avatar.
    "/settings",
    "/settings/team",
    "/settings/security",
    "/settings/payments",
    "/settings/linked-accounts",
  ];

  it.each(SUBTABS)("%s resolves a direct page config", (path) => {
    const config = getPageConfig(path);
    expect(config).not.toBeNull();
    expect(config?.slug).toBe(path);
    expect(config?.requiresAuth).toBe(true);
  });

  it.each(SUBTABS)("%s is NOT masterOnly (member would get /403)", (path) => {
    expect(pageIsMasterOnly(path)).toBe(false);
  });

  it.each(SUBTABS)("%s has NO requiredPermission (member would get /403)", (path) => {
    expect(getPageConfig(path)?.requiredPermission).toBeUndefined();
  });
});

/**
 * A guarda de rota lê a MESMA chave que a tela de Equipe grava. Uma página
 * marcável cujo pageId não aparece em nenhuma entrada do PAGE_CONFIG é um
 * toggle que o master marca e que não impede acesso direto por URL — foi o
 * caso de kanban, spreadsheets, solutions e wallet.
 */
describe("toda página marcável na tela de Equipe tem guarda de rota", () => {
  const gatedPageIds = new Set(
    Object.values(PAGE_CONFIG)
      .filter((config) => config.requiredPermission === "view")
      .map((config) => config.pageId),
  );

  it.each(PERMISSION_PAGES.map((page) => page.id))(
    "%s é gateado por alguma rota",
    (pageId) => {
      expect(gatedPageIds).toContain(pageId);
    },
  );
});

/**
 * Regressão: o PAGE_CONFIG registrava "/clients", mas a rota real é
 * "/contacts" — logo getPageConfig("/contacts") devolvia null e o
 * ProtectedRoute deixava passar quem não tinha a permissão.
 */
describe("rotas apontam para caminhos que existem de fato", () => {
  const ROUTES: Array<[string, string]> = [
    ["/contacts", "clients"],
    ["/contacts/42", "clients"],
    ["/services", "services"],
    ["/services/new", "services"],
    ["/spreadsheets", "spreadsheets"],
    ["/solutions", "solutions"],
    ["/ambientes", "solutions"],
    ["/crm", "kanban"],
    ["/wallets", "wallet"],
    ["/transactions", "transactions"],
    ["/calendar", "calendar"],
    ["/invoices", "invoices"],
  ];

  it.each(ROUTES)("%s resolve pageId %s exigindo view", (path, pageId) => {
    const config = getPageConfig(path);
    expect(config?.pageId).toBe(pageId);
    expect(config?.requiredPermission).toBe("view");
  });

  it("não existe mais a entrada órfã /clients", () => {
    expect(PAGE_CONFIG["/clients"]).toBeUndefined();
  });
});

/**
 * Metas e Link de agendamento saíram de Configurações para os grupos
 * Financeiro e Agenda, e levaram junto a decisão de acesso: o portão (plano e
 * administrador) fica dentro da tela, então a rota não pode mandar o membro
 * para /403.
 */
describe("visões de configuração dentro dos grupos", () => {
  it.each(["/goals", "/booking"])("%s abre para qualquer usuário logado", (path) => {
    const config = getPageConfig(path);
    expect(config?.slug).toBe(path);
    expect(config?.requiresAuth).toBe(true);
    expect(pageIsMasterOnly(path)).toBe(false);
    expect(config?.requiredPermission).toBeUndefined();
  });
});
