import { describe, expect, it } from "vitest";
import { NICHE_CONFIGS } from "@/lib/niches/config";
import { TENANT_NICHES } from "@/lib/niches/registry";
import {
  cap,
  count,
  deste,
  do_,
  nenhum,
  nele,
  novo,
  o,
  outro,
  pick,
  term,
  um,
} from "@/lib/niches/vocabulary";

/**
 * Concordância de gênero do vocabulário do nicho: em automação o local é "o
 * ambiente" e o grupo "a solução"; em segurança, "a área" e "o sistema".
 */
const ambiente = term("ambiente", "ambientes", "m");
const area = term("área", "áreas", "f");

describe("helpers de concordância", () => {
  it.each([
    [ambiente, "o", "um", "do", "deste", "novo", "nenhum", "outro", "nele"],
    [area, "a", "uma", "da", "desta", "nova", "nenhuma", "outra", "nela"],
  ])("%o", (t, art, indef, contr, dem, adj, neg, other, pron) => {
    expect([o(t), um(t), do_(t), deste(t), novo(t), nenhum(t), outro(t), nele(t)]).toEqual([
      art,
      indef,
      contr,
      dem,
      adj,
      neg,
      other,
      pron,
    ]);
  });

  it("frases montadas concordam nos dois gêneros", () => {
    const nova = (t: typeof area) => `${cap(novo(t))} ${t.singular}`;
    expect(nova(ambiente)).toBe("Novo ambiente");
    expect(nova(area)).toBe("Nova área");
    expect(`${cap(o(area))} ${area.singular} será ${pick(area, "excluído", "excluída")}`).toBe(
      "A área será excluída",
    );
  });

  it("contagem no singular e no plural", () => {
    expect(count(area, 1)).toBe("1 área");
    expect(count(area, 3)).toBe("3 áreas");
  });
});

describe("textos derivados do vocabulário", () => {
  it("segurança fala de sistemas e áreas", () => {
    const config = NICHE_CONFIGS.seguranca_eletronica;
    expect(config.solutionsPage.navigationLabel).toBe("Sistemas");
    expect(config.solutionsPage.pageDescription).toBe("Central de gerenciamento de sistemas e áreas.");
    expect(config.pdf.groupSubtotalLabel).toBe("Subtotal do Sistema:");
    expect(config.pdf.groupSubtotalOptionLabel).toBe("Mostrar subtotal por sistema");
  });

  it("automação continua com soluções e ambientes", () => {
    const config = NICHE_CONFIGS.automacao_residencial;
    expect(config.solutionsPage.navigationLabel).toBe("Soluções");
    expect(config.pdf.groupSubtotalLabel).toBe("Subtotal da Solução:");
    expect(config.proposal.groupsStep.heading).toBe("Soluções de Automação");
    expect(config.proposal.groupsStep.emptySelectionError).toBe(
      "Selecione pelo menos 1 solução com produtos",
    );
  });

  it("persianas: o grupo é o próprio ambiente", () => {
    const config = NICHE_CONFIGS.cortinas;
    expect(config.solutionsPage.navigationLabel).toBe("Ambientes");
    expect(config.pdf.groupSubtotalLabel).toBe("Subtotal do Ambiente:");
    expect(config.proposal.groupsStep.stepTitle).toBe("Ambientes");
  });

  it.each([...TENANT_NICHES])("%s declara o vocabulário inteiro, em minúsculas", (niche) => {
    const v = NICHE_CONFIGS[niche].vocabulary;
    for (const t of [v.place, v.group]) {
      expect(t.singular).toBe(t.singular.toLowerCase());
      expect(t.plural).toBe(t.plural.toLowerCase());
      expect(["m", "f"]).toContain(t.gender);
    }
    expect(v.placeExamples && v.groupExamples && v.productNamePlaceholder).toBeTruthy();
  });
});
