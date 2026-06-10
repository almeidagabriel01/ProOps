import { describe, it, expect } from "vitest";
import { getPageConfig, pageIsMasterOnly } from "../page-config";

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
    "/settings/team",
    "/settings/security",
    "/settings/payments",
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
