// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import type { TenantNiche } from "@/types";

/**
 * Soluções e Ambientes mudam de nome por nicho. A dock, a tab bar, o "Mais" e o
 * seletor de visão leem todos `useNavigationItems` (via `useDockEntries`), então
 * é aqui que o rótulo precisa chegar certo, e um lugar só basta.
 */

let niche: TenantNiche = "automacao_residencial";

vi.mock("@/providers/permissions-provider", () => ({
  usePermissions: () => ({ hasPermission: () => true, isMaster: true }),
}));
vi.mock("@/providers/tenant-provider", () => ({
  useTenant: () => ({ tenant: { id: "t1", niche }, isDemo: false }),
}));

import { useNavigationItems } from "../use-navigation-items";
import { nicheMenuLabel } from "../navigation-config";
import { getNicheConfig, NICHE_CONFIGS } from "@/lib/niches/config";
import { term } from "@/lib/niches/vocabulary";

function catalogLabels(target: TenantNiche): Record<string, string> {
  niche = target;
  const { result } = renderHook(() => useNavigationItems());
  const catalog = result.current.visibleMenuItems.find(
    (item) => item.label === "Catálogo",
  );
  return Object.fromEntries(
    (catalog?.children ?? []).map((child) => [child.href, child.label]),
  );
}

describe("rótulos do Catálogo por nicho", () => {
  it("automação: Soluções, sem Ambientes", () => {
    const labels = catalogLabels("automacao_residencial");
    expect(labels["/solutions"]).toBe("Soluções");
    expect(labels["/ambientes"]).toBeUndefined();
  });

  it("segurança eletrônica: Sistemas, sem Ambientes", () => {
    const labels = catalogLabels("seguranca_eletronica");
    expect(labels["/solutions"]).toBe("Sistemas");
    expect(labels["/ambientes"]).toBeUndefined();
  });

  it("persianas e toldos: Ambientes, sem Soluções", () => {
    const labels = catalogLabels("cortinas");
    expect(labels["/ambientes"]).toBe("Ambientes");
    expect(labels["/solutions"]).toBeUndefined();
  });
});

describe("nicheMenuLabel", () => {
  it("o rótulo de /ambientes segue o local do nicho", () => {
    const config = {
      ...NICHE_CONFIGS.cortinas,
      vocabulary: { ...NICHE_CONFIGS.cortinas.vocabulary, place: term("área", "áreas", "f") },
    };
    expect(nicheMenuLabel("/ambientes", config)).toBe("Áreas");
  });

  it("o rótulo de /solutions é o da página do nicho", () => {
    for (const id of Object.keys(NICHE_CONFIGS) as TenantNiche[]) {
      expect(nicheMenuLabel("/solutions", getNicheConfig(id))).toBe(
        getNicheConfig(id).solutionsPage.navigationLabel,
      );
    }
  });

  it("os outros destinos ficam com o rótulo do menu", () => {
    expect(nicheMenuLabel("/products", getNicheConfig("seguranca_eletronica"))).toBeUndefined();
  });
});
