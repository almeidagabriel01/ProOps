import { describe, expect, it } from "vitest";

/**
 * Não há workspace compartilhado entre `apps/web` e `apps/functions`, então o
 * saneamento de texto fiscal existe nos dois — o backend porque é ele que
 * garante o que sai para a SEFAZ, o frontend para o usuário ver o que será
 * enviado enquanto digita.
 *
 * Duas cópias divergem em silêncio: o front deixaria passar um caractere que o
 * back corta, e o texto exibido deixaria de ser o texto registrado. Como a
 * CC-e é CUMULATIVA e o diálogo reabre pré-preenchido com a última, essa
 * divergência reenviaria justamente o caractere recusado.
 *
 * O import atravessa para `apps/functions` — vale só em teste, nunca em código
 * de runtime.
 */

import { sanitizarTextoFiscal } from "@/lib/fiscal/texto-fiscal";
import { sanitizeFiscalText } from "../../../functions/src/api/services/fiscal/fiscal-text";

const CORPUS = [
  "O endereço de entrega correto é Rua das Palmeiras, 320 — Centro",
  "Endereço: Avenida São João, ação nº 3",
  "primeira linha\nsegunda linha",
  "uma\n\n\noutra",
  "o \u201Cvalor\u201D do cliente\u2019s",
  "valor\u00A0final\u200B",
  "  texto corrigido  ",
  "entrega ok \u{1F4E6} confirmada",
  "reticências\u2026 e meia-risca \u2013 aqui",
  "tabulação\tno meio",
  "",
];

describe("saneamento de texto fiscal — front e back", () => {
  it("as duas cópias produzem o mesmo resultado", () => {
    for (const entrada of CORPUS) {
      expect(sanitizarTextoFiscal(entrada)).toBe(sanitizeFiscalText(entrada));
    }
  });
});
