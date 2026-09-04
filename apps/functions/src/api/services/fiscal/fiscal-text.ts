/**
 * Texto livre em documento fiscal: o XSD da NF-e nao aceita Unicode inteiro.
 *
 * O padrao dos campos de texto e
 * `[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}` — ou seja **U+0020 a U+00FF**, sem
 * espaco na primeira nem na ultima posicao. Latin-1 acentuado passa (`ç`, `é`,
 * `ã`); o que NAO passa e justamente o que teclado e editor moderno produzem
 * sozinhos:
 *
 * - **travessao `—` (U+2014)** — foi o que rejeitou a primeira carta de
 *   correcao real, copiado do proprio placeholder do dialogo;
 * - **aspas e apostrofos curvos** (`“ ” ‘ ’`), que todo editor de texto e o
 *   iOS aplicam na digitacao;
 * - **quebra de linha (U+000A)**, abaixo de U+0020 — e o campo da CC-e e um
 *   `<textarea>` de 5 linhas, entao um Enter bastava;
 * - **espaco nao separavel (U+00A0)**, invisivel, tipico de texto colado da
 *   web.
 *
 * A rejeicao vem da SEFAZ como erro de schema, citando o codepoint — mensagem
 * que nao ajuda ninguem a entender que o problema e um traco. Por isso a
 * conversao acontece aqui, e nao uma recusa: a intencao de quem escreveu esta
 * preservada em todos esses casos, e trocar `—` por `-` nao muda o sentido de
 * uma correcao fiscal.
 */

/** Substituicoes que preservam o sentido, aplicadas antes do corte. */
const EQUIVALENTES: Array<[RegExp, string]> = [
  // Travessoes, meia-risca e sinal de menos → hifen ASCII.
  [/[\u2010-\u2015\u2212]/g, "-"],
  // Aspas simples curvas e prima → apostrofo.
  [/[\u2018\u2019\u201A\u201B\u2032]/g, "'"],
  // Aspas duplas curvas e prima dupla → aspas retas.
  [/[\u201C\u201D\u201E\u201F\u2033]/g, '"'],
  [/\u2026/g, "..."],
  // Quebra de linha, tabulacao e espacos exoticos → espaco simples.
  [/[\r\n\t\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " "],
  // Largura zero e BOM: invisiveis, entao remover e menos surpreendente que
  // virar espaco.
  [/[\u200B-\u200D\uFEFF]/g, ""],
];

/** Fora do intervalo do XSD (U+0020 a U+00FF). */
const FORA_DO_PADRAO = /[^\u0020-\u00FF]/g;

/**
 * Deixa o texto dentro do que o XSD da NF-e aceita.
 *
 * Nao valida tamanho: cada campo tem o seu, e o corte muda o comprimento —
 * quem valida precisa faze-lo DEPOIS desta funcao.
 */
export function sanitizeFiscalText(texto: string): string {
  let saida = String(texto ?? "");
  for (const [de, para] of EQUIVALENTES) {
    saida = saida.replace(de, para);
  }
  return saida
    .replace(FORA_DO_PADRAO, "")
    // Espacos repetidos sobram das quebras de linha convertidas.
    .replace(/ {2,}/g, " ")
    // A primeira e a ultima posicao nao aceitam espaco.
    .trim();
}
