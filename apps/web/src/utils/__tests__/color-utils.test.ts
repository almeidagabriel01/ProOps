import { describe, expect, it } from "vitest";
import {
  computePrimaryForeground,
  ensureDarkModeContrast,
  ensureLightModeContrast,
  getContrastRatio,
  normalizeHex,
} from "../color-utils";

// Mesmas aproximações de fundo usadas por ensure*Contrast.
const DARK_BG = "#1c1c1c";
const LIGHT_BG = "#f4f5f8";

describe("normalizeHex", () => {
  it("expande a forma curta", () => {
    expect(normalizeHex("#fff")).toBe("#ffffff");
    expect(normalizeHex("#0Af")).toBe("#00aaff");
  });

  it("normaliza a forma longa para minúsculas e aceita sem #", () => {
    expect(normalizeHex("#0A0A0A")).toBe("#0a0a0a");
    expect(normalizeHex("2563eb")).toBe("#2563eb");
  });

  it("devolve null para valor inválido ou ausente", () => {
    expect(normalizeHex("")).toBeNull();
    expect(normalizeHex(undefined)).toBeNull();
    expect(normalizeHex("#12345")).toBeNull();
    expect(normalizeHex("red")).toBeNull();
  });
});

describe("contraste da cor da empresa com o tema", () => {
  it("preto quase puro (#0a0a0a) fica legível no tema escuro", () => {
    const adjusted = ensureDarkModeContrast("#0a0a0a");
    expect(adjusted).not.toBe("#0a0a0a");
    expect(getContrastRatio(adjusted, DARK_BG)).toBeGreaterThanOrEqual(4.5);
  });

  it("branco fica legível no tema claro", () => {
    const adjusted = ensureLightModeContrast("#ffffff");
    expect(adjusted).not.toBe("#ffffff");
    expect(getContrastRatio(adjusted, LIGHT_BG)).toBeGreaterThanOrEqual(4.5);
  });

  it("cor já legível não muda", () => {
    expect(ensureLightModeContrast("#2563eb")).toBe("#2563eb");
    expect(ensureDarkModeContrast("#ffffff")).toBe("#ffffff");
    expect(ensureLightModeContrast("#0a0a0a")).toBe("#0a0a0a");
  });

  it("texto sobre a cor ajustada é escuro no tema escuro e claro no tema claro", () => {
    // Preto ajustado no escuro vira cinza claro: branco por cima some.
    expect(computePrimaryForeground(ensureDarkModeContrast("#0a0a0a"))).toBe(
      "#1f2937",
    );
    // Branco ajustado no claro vira cinza escuro: pede texto branco.
    expect(computePrimaryForeground(ensureLightModeContrast("#ffffff"))).toBe(
      "#ffffff",
    );
  });
});
