import { describe, expect, it } from "vitest";
import {
  ICMS_SITUACOES as backendIcms,
  PIS_COFINS_CSTS as backendPisCofins,
  icmsKindForRegime as backendKind,
} from "../../../functions/src/api/services/fiscal/tax-codes";
import {
  ICMS_SITUACOES as frontIcms,
  PIS_COFINS_CSTS as frontPisCofins,
  icmsKindForRegime as frontKind,
} from "@/lib/fiscal/tax-codes";

/**
 * A tela oferece os códigos que o backend aceita. Uma cópia andando sozinha
 * ofereceria um código que a API recusa com 400, ou esconderia um que ela
 * aceita, ou mostraria o campo de alíquota para um código que o ignora.
 */
describe("códigos fiscais da nota: front e backend iguais", () => {
  it("mesma situação do ICMS, com o mesmo destaque e o mesmo crédito", () => {
    expect(frontIcms).toEqual(backendIcms);
  });

  it("mesmo CST de PIS e COFINS, com o mesmo grupo", () => {
    expect(frontPisCofins).toEqual(backendPisCofins);
  });

  it("mesmo tipo de código por regime", () => {
    for (const regime of [1, 2, 3, 4]) {
      expect(frontKind(regime)).toBe(backendKind(regime));
    }
  });
});
