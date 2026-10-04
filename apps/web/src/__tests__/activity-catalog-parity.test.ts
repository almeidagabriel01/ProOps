import { describe, expect, it } from "vitest";
import {
  ACTIVITY_CATEGORIES as backendCategories,
  ROUTE_BLOCKED_REASONS as backendReasons,
  SUBSCRIBE_CLICK_SOURCES as backendSources,
  TENANT_ACTIVITY_CATALOG as backendCatalog,
  TENANT_ACTIVITY_TYPES as backendTypes,
} from "../../../functions/src/shared/tenant-activity-catalog";
import { normalizeActivityRoute as backendNormalize } from "../../../functions/src/shared/activity-route";
import {
  ACTIVITY_CATEGORIES as frontCategories,
  ACTIVITY_CATEGORY_LABELS,
  ROUTE_BLOCKED_REASON_LABELS,
  SUBSCRIBE_CLICK_SOURCE_LABELS,
  TENANT_ACTIVITY_CATALOG as frontCatalog,
  TENANT_ACTIVITY_TYPES as frontTypes,
} from "@/lib/activity/catalog";
import { normalizeActivityRoute as frontNormalize } from "@/lib/activity/normalize-route";

/**
 * O navegador manda o tipo e o painel mostra o rótulo; o backend decide o que
 * grava. Uma cópia velha no front mandaria tipo que o servidor descarta, ou
 * mostraria a jornada com rótulo errado.
 */
describe("catálogo da atividade: front e backend iguais", () => {
  it("mesmos tipos", () => {
    expect([...frontTypes].sort()).toEqual([...backendTypes].sort());
  });

  it.each([...backendTypes])("%s: mesma categoria, rótulo e origem", (type) => {
    const back = backendCatalog[type];
    const front = frontCatalog[type];
    expect({ category: front.category, label: front.label, client: front.client }).toEqual({
      category: back.category,
      label: back.label,
      client: back.client,
    });
  });

  it("mesmas categorias, todas com rótulo", () => {
    expect([...frontCategories]).toEqual([...backendCategories]);
    for (const category of frontCategories) expect(ACTIVITY_CATEGORY_LABELS[category]).toBeTruthy();
  });

  it("toda origem do clique em Assinar e todo motivo de tela bloqueada têm rótulo no painel", () => {
    expect(Object.keys(SUBSCRIBE_CLICK_SOURCE_LABELS).sort()).toEqual([...backendSources].sort());
    expect(Object.keys(ROUTE_BLOCKED_REASON_LABELS).sort()).toEqual([...backendReasons].sort());
  });
});

describe("normalização de rota: front e backend iguais", () => {
  it.each([
    "/proposals",
    "/proposals/aB3dE9fG7hJ2kL1mN0pQ/edit",
    "/transactions?status=paid#top",
    "/share/9f1c2b7a-1234-4abc-9def-001122334455",
    "/clients/12345",
    "/automacao-residencial",
    "/v1/proposals/tenant_abc123",
    "/contatos/joão%20silva",
    "/proposals/",
    "/",
    "https://evil.com/x",
    "",
  ])("%s", (input) => {
    expect(frontNormalize(input)).toBe(backendNormalize(input));
  });
});
