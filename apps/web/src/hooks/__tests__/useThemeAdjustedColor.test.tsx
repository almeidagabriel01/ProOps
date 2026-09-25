// @vitest-environment jsdom
/**
 * A cor da empresa pintada na tela do ERP precisa contrastar com o tema.
 *
 * O bug: com a cor #0a0a0a, o formulário de proposta pintava título, tag do
 * ambiente e "Valor Final" em preto sobre o fundo escuro, porque lia a cor
 * crua do tenant. O espelho é a empresa de cor branca no tema claro.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { getContrastRatio } from "@/utils/color-utils";

let resolvedTheme: "dark" | "light" = "dark";
let tenantColor: string | undefined = "#0a0a0a";

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme }),
}));
vi.mock("@/providers/tenant-provider", () => ({
  useTenant: () => ({ tenant: { primaryColor: tenantColor } }),
}));

import { useThemeAdjustedColor } from "../useThemeAdjustedColor";
import { useThemePrimaryColor } from "../useThemePrimaryColor";

const DARK_BG = "#1c1c1c";
const LIGHT_BG = "#f4f5f8";

function adjusted(color: string | undefined) {
  return renderHook(() => useThemeAdjustedColor(color)).result.current;
}

describe("useThemeAdjustedColor", () => {
  beforeEach(() => {
    resolvedTheme = "dark";
  });

  it("#0a0a0a no tema escuro fica legível (cenário reportado)", () => {
    const color = adjusted("#0a0a0a");
    expect(getContrastRatio(color, DARK_BG)).toBeGreaterThanOrEqual(4.5);
  });

  it("branco no tema claro fica legível", () => {
    resolvedTheme = "light";
    const color = adjusted("#ffffff");
    expect(getContrastRatio(color, LIGHT_BG)).toBeGreaterThanOrEqual(4.5);
  });

  it("branco na forma curta (#fff) também é ajustado, sem NaN", () => {
    resolvedTheme = "light";
    const color = adjusted("#fff");
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
    expect(getContrastRatio(color, LIGHT_BG)).toBeGreaterThanOrEqual(4.5);
  });

  it("preto no tema claro e branco no escuro continuam como estão", () => {
    resolvedTheme = "light";
    expect(adjusted("#0a0a0a")).toBe("#0a0a0a");
    resolvedTheme = "dark";
    expect(adjusted("#ffffff")).toBe("#ffffff");
  });

  it("cor comum não muda em nenhum dos temas", () => {
    resolvedTheme = "light";
    expect(adjusted("#2563eb")).toBe("#2563eb");
    resolvedTheme = "dark";
    expect(getContrastRatio(adjusted("#2563eb"), DARK_BG)).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it("cor inválida ou ausente cai no azul padrão", () => {
    resolvedTheme = "light";
    const fallback = adjusted("#3b82f6");
    expect(adjusted(undefined)).toBe(fallback);
    expect(adjusted("vermelho")).toBe(fallback);
  });
});

describe("useThemePrimaryColor", () => {
  it("usa a cor do tenant já ajustada ao tema", () => {
    resolvedTheme = "dark";
    tenantColor = "#0a0a0a";
    const color = renderHook(() => useThemePrimaryColor()).result.current;
    expect(getContrastRatio(color, DARK_BG)).toBeGreaterThanOrEqual(4.5);
  });
});
