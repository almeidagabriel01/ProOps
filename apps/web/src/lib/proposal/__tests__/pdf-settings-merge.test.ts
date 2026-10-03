import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PDF_DISPLAY_DEFAULT_KEYS,
  mergeEditorPdfSettings,
  pickPdfDisplayDefaults,
} from "@/lib/proposal/pdf-settings-merge";

const savedByForm = {
  showProductPrices: true,
  showProductImages: false,
  showNotes: false,
  theme: "modern",
  primaryColor: "#111111",
  coverImage: "https://img/antiga.png",
};

const editorState = {
  theme: "elegant",
  primaryColor: "#2255aa",
  fontFamily: "Inter",
  coverImage: undefined,
  sections: [],
};

describe("mergeEditorPdfSettings", () => {
  it("caso real: salvar no editor nao apaga o 'mostrar preco' da proposta", () => {
    const merged = mergeEditorPdfSettings(savedByForm, editorState);
    expect(merged.showProductPrices).toBe(true);
    expect(merged.showProductImages).toBe(false);
    expect(merged.showNotes).toBe(false);
  });

  it("o estilo do editor substitui o gravado", () => {
    const merged = mergeEditorPdfSettings(savedByForm, editorState);
    expect(merged.theme).toBe("elegant");
    expect(merged.primaryColor).toBe("#2255aa");
    expect(merged.fontFamily).toBe("Inter");
  });

  it("chave do editor sem valor remove a gravada (capa retirada)", () => {
    const merged = mergeEditorPdfSettings(savedByForm, editorState);
    expect(merged.coverImage).toBeUndefined();
  });

  it("padrao da empresa: o editor nao apaga as caixinhas ja salvas como padrao", () => {
    const merged = mergeEditorPdfSettings({ showProductPrices: true, productLayout: "table" }, editorState);
    expect(merged).toMatchObject({ showProductPrices: true, productLayout: "table", theme: "elegant" });
  });

  it("sem nada gravado, fica so o estilo", () => {
    expect(mergeEditorPdfSettings(undefined, { theme: "modern" })).toEqual({ theme: "modern" });
  });
});

describe("editor de PDF grava pelo merge", () => {
  const hook = fs.readFileSync(
    path.resolve(
      __dirname,
      "../../../components/features/proposal/edit-pdf/use-edit-pdf-page.ts",
    ),
    "utf8",
  );

  it("salvar a proposta e salvar como padrao passam pelo merge", () => {
    expect(hook.match(/mergeEditorPdfSettings\(/g)?.length).toBe(2);
    expect(hook).not.toMatch(/=\s*cleanForFirestore\(currentSettingsObj\)\s*;/);
  });
});

describe("pickPdfDisplayDefaults (padrao da empresa)", () => {
  it("leva so as caixinhas, sem o estilo nem o layout", () => {
    expect(
      pickPdfDisplayDefaults({
        showProductPrices: true,
        showProductImages: false,
        theme: "modern",
        productLayout: "table",
      }),
    ).toEqual({ showProductPrices: true, showProductImages: false });
  });

  it("as chaves batem com as que o backend aceita sem o editor de PDF", () => {
    const guards = fs.readFileSync(
      path.resolve(__dirname, "../../../../../functions/src/lib/catalog-plan-guards.ts"),
      "utf8",
    );
    const block = guards.slice(guards.indexOf("PDF_DISPLAY_DEFAULT_KEYS"));
    const backendKeys = Array.from(
      block.slice(0, block.indexOf("]);")).matchAll(/"(show\w+)"/g),
      (match) => match[1],
    );
    expect([...backendKeys].sort()).toEqual([...PDF_DISPLAY_DEFAULT_KEYS].sort());
  });
});
