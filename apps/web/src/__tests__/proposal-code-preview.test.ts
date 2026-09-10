import { describe, expect, it } from "vitest";

import {
  buildProposalCodePreview,
  normalizePraca,
} from "@/lib/proposal-numbering";
import {
  buildProposalCode,
  normalizePraca as normalizePracaBackend,
} from "../../../functions/src/api/controllers/proposal-numbering";

/**
 * O front tem uma CÓPIA da montagem do código da proposta, para mostrar a
 * prévia enquanto a pessoa mexe nos campos de `/settings/proposals` sem uma ida
 * ao servidor por tecla digitada.
 *
 * A fonte da verdade é o backend: é ele que aloca o número dentro da transação
 * de criação e grava `proposalCode`. Uma divergência entre os dois não quebra
 * nada visivelmente, e é justamente esse o problema: a tela prometeria um
 * código e a proposta nasceria com outro.
 */

const CASOS: { number: number; year: number; praca: string | null; digits?: number }[] = [
  // O caso do cliente que originou a funcionalidade.
  { number: 185, year: 2026, praca: "SP" },
  { number: 185, year: 2026, praca: "RJ" },
  // Empresa sem praça nenhuma configurada.
  { number: 185, year: 2026, praca: null },
  // Zero à esquerda do ano.
  { number: 1, year: 2007, praca: "SP" },
  // Largura configurada diferente do padrão.
  { number: 7, year: 2026, praca: "RJ", digits: 3 },
  // Sequencial mais largo que a configuração: não pode truncar dos dois lados.
  { number: 123456, year: 2026, praca: "SP", digits: 5 },
  // Virada de década e de século no ano de dois dígitos.
  { number: 42, year: 2030, praca: "SP" },
  { number: 42, year: 2100, praca: "SP" },
];

describe("prévia do código da proposta", () => {
  it.each(CASOS)(
    "monta igual ao backend: $number/$year/$praca",
    (caso) => {
      expect(buildProposalCodePreview(caso)).toBe(buildProposalCode(caso));
    },
  );

  it("normaliza a praça igual ao backend", () => {
    for (const entrada of ["SP", "sp", "S.P.", " Sp ", "são", "", "rj-1"]) {
      expect(normalizePraca(entrada)).toBe(normalizePracaBackend(entrada));
    }
  });

  it("trata praça ausente igual ao backend", () => {
    expect(normalizePraca(null)).toBe(normalizePracaBackend(null));
    expect(normalizePraca(undefined)).toBe(normalizePracaBackend(undefined));
  });
});
