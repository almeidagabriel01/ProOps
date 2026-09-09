/**
 * Texto livre em documento fiscal: o XSD da NF-e não aceita Unicode inteiro.
 *
 * O padrão dos campos de texto é `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}` — ou seja
 * **U+0020 a U+00FF**, sem espaço na primeira nem na última posição. Latin-1
 * acentuado passa (`ç`, `é`, `ã`); o que não passa é o que teclado e editor
 * moderno produzem sozinhos: travessão, aspas curvas, quebra de linha e espaço
 * não separável.
 *
 * **Cópia deliberada** de `apps/functions/src/api/services/fiscal/fiscal-text.ts`.
 * O backend é o autoritativo — ele saneia de novo antes de enviar e de gravar,
 * então nenhuma chamada escapa. Esta cópia existe para o usuário ver o que
 * será enviado enquanto digita, em vez de descobrir na recusa; sem ela o
 * contador de caracteres também mentiria, porque o corte muda o comprimento.
 *
 * As duas são comparadas em `src/__tests__/fiscal-text-parity.test.ts`.
 */

const EQUIVALENTES: Array<[RegExp, string]> = [
  [/[\u2010-\u2015\u2212]/g, "-"],
  [/[\u2018\u2019\u201A\u201B\u2032]/g, "'"],
  [/[\u201C\u201D\u201E\u201F\u2033]/g, '"'],
  [/\u2026/g, "..."],
  [/[\r\n\t\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " "],
  [/[\u200B-\u200D\uFEFF]/g, ""],
];

const FORA_DO_PADRAO = /[^\u0020-\u00FF]/g;

/** Deixa o texto dentro do que o XSD da NF-e aceita. Não valida tamanho. */
export function sanitizarTextoFiscal(texto: string): string {
  let saida = String(texto ?? "");
  for (const [de, para] of EQUIVALENTES) {
    saida = saida.replace(de, para);
  }
  return saida
    .replace(FORA_DO_PADRAO, "")
    .replace(/ {2,}/g, " ")
    .trim();
}
