// @vitest-environment jsdom
/**
 * O bloco de produtos do PDF grava "Sistemas / Ambientes / Produtos" em
 * `section.content`, e o editor compara esse valor para saber se a estrutura
 * já está normalizada. O rótulo na tela passou a seguir o nicho; o valor
 * gravado não pode seguir junto, senão toda proposta salva seria tida como
 * fora do padrão e reescrita ao abrir o editor.
 */

import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { PdfSection } from "@/types/pdf.types";
import { NICHE_CONFIGS } from "@/lib/niches/config";
import {
  PRODUCT_TABLE_SECTION_MARKER,
  productTableSectionContents,
  productTableSectionLabel,
  productTableSectionShortName,
} from "@/lib/proposal-product-table-section";
import { usePdfSectionEditor } from "../use-pdf-section-editor";
import { ensureCanonicalSectionStructure } from "../../edit-pdf/pdf-hydration-utils";

vi.mock("@/lib/toast", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

const styles = { fontSize: "14px" } as PdfSection["styles"];

function productTable(content: string): PdfSection {
  return {
    id: "pt",
    groupId: "scope",
    type: "product-table",
    content,
    columnWidth: 100,
    styles,
  };
}

describe("marcador gravado do bloco de produtos", () => {
  it("o valor gravado continua o mesmo de sempre", () => {
    expect(PRODUCT_TABLE_SECTION_MARKER).toBe("Sistemas / Ambientes / Produtos");
  });

  it("uma estrutura salva com o marcador é reconhecida e não é reescrita", () => {
    const onChange = vi.fn();
    renderHook(() =>
      usePdfSectionEditor({
        sections: [productTable("Sistemas / Ambientes / Produtos")],
        onChange,
        primaryColor: "#000000",
      }),
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("o rótulo de tela nunca vira o valor gravado", () => {
    const onChange = vi.fn();
    const label = productTableSectionLabel(
      NICHE_CONFIGS.seguranca_eletronica.vocabulary,
    );
    renderHook(() =>
      usePdfSectionEditor({
        sections: [productTable(label)],
        onChange,
        primaryColor: "#000000",
      }),
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    const [normalized] = onChange.mock.calls[0] as [PdfSection[]];
    const table = normalized.find((s) => s.type === "product-table");
    expect(table?.content).toBe("Sistemas / Ambientes / Produtos");
  });

  it("a estrutura canônica do PDF mantém e cria o bloco com o marcador", () => {
    const kept = ensureCanonicalSectionStructure([
      productTable("Sistemas / Ambientes / Produtos"),
    ]);
    expect(kept.find((s) => s.type === "product-table")?.content).toBe(
      "Sistemas / Ambientes / Produtos",
    );

    const created = ensureCanonicalSectionStructure([]);
    expect(created.find((s) => s.type === "product-table")?.content).toBe(
      "Sistemas / Ambientes / Produtos",
    );
  });
});

describe("rótulo do bloco de produtos por nicho", () => {
  it("automação fala em soluções e ambientes", () => {
    const v = NICHE_CONFIGS.automacao_residencial.vocabulary;
    expect(productTableSectionLabel(v)).toBe("Soluções / Ambientes / Produtos");
    expect(productTableSectionShortName(v)).toBe("Produtos/Soluções/Ambientes");
    expect(productTableSectionContents(v)).toBe("soluções, ambientes e produtos");
  });

  it("segurança fala em sistemas e áreas", () => {
    const v = NICHE_CONFIGS.seguranca_eletronica.vocabulary;
    expect(productTableSectionLabel(v)).toBe("Sistemas / Áreas / Produtos");
    expect(productTableSectionShortName(v)).toBe("Produtos/Sistemas/Áreas");
    expect(productTableSectionContents(v)).toBe("sistemas, áreas e produtos");
  });

  it("persianas não repete ambiente, que é o grupo e o local", () => {
    const v = NICHE_CONFIGS.cortinas.vocabulary;
    expect(productTableSectionLabel(v)).toBe("Ambientes / Produtos");
    expect(productTableSectionShortName(v)).toBe("Produtos/Ambientes");
    expect(productTableSectionContents(v)).toBe("ambientes e produtos");
  });
});
