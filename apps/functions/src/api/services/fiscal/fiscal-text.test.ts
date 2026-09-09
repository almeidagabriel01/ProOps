/**
 * O XSD da NF-e aceita U+0020 a U+00FF — nao Unicode inteiro.
 *
 * A primeira carta de correcao real foi recusada por um travessao `—`
 * (U+2014), copiado do placeholder do proprio dialogo. A rejeicao vem como
 * erro de schema citando o codepoint, mensagem que nao ajuda ninguem a
 * entender que o problema e um traco.
 */

import { sanitizeFiscalText } from "./fiscal-text";

/** O padrao literal do XSD, para provar a saida em vez de descreve-la. */
const PADRAO_XSD = /^([!-\u00FF][ -\u00FF]*[!-\u00FF]|[!-\u00FF])$/;

describe("sanitizeFiscalText", () => {
  it("aceita o texto que rejeitou a primeira carta real", () => {
    const original =
      "O endereço de entrega correto é Rua das Palmeiras, 320 — Centro";

    const limpo = sanitizeFiscalText(original);

    expect(limpo).toBe(
      "O endereço de entrega correto é Rua das Palmeiras, 320 - Centro",
    );
    expect(limpo).toMatch(PADRAO_XSD);
  });

  it("preserva acentos — Latin-1 passa no XSD", () => {
    // Cortar acento seria "resolver" trocando a rejeicao por uma nota errada.
    const limpo = sanitizeFiscalText("Endereço: Avenida São João, ação nº 3");

    expect(limpo).toBe("Endereço: Avenida São João, ação nº 3");
    expect(limpo).toMatch(PADRAO_XSD);
  });

  it("converte quebra de linha em espaco", () => {
    // O campo da CC-e e um textarea de 5 linhas e U+000A esta ABAIXO de U+0020:
    // um Enter bastava para a mesma recusa.
    const limpo = sanitizeFiscalText("primeira linha\nsegunda linha");

    expect(limpo).toBe("primeira linha segunda linha");
    expect(limpo).toMatch(PADRAO_XSD);
  });

  it("nao deixa espaco sobrando ao juntar linhas", () => {
    expect(sanitizeFiscalText("uma\n\n\noutra")).toBe("uma outra");
  });

  it("converte aspas e apostrofos curvos", () => {
    // Editor de texto e teclado do iOS aplicam isso sozinhos, sem o usuario
    // perceber que digitou outro caractere.
    const limpo = sanitizeFiscalText("o \u201Cvalor\u201D do cliente\u2019s");

    expect(limpo).toBe('o "valor" do cliente\'s');
    expect(limpo).toMatch(PADRAO_XSD);
  });

  it("remove invisiveis colados da web", () => {
    // Espaco nao separavel e largura zero: ninguem ve, e a nota e recusada.
    expect(sanitizeFiscalText("valor\u00A0final\u200B")).toBe("valor final");
  });

  it("tira espaco das pontas — o padrao nao os aceita ali", () => {
    expect(sanitizeFiscalText("  texto corrigido  ")).toBe("texto corrigido");
  });

  it("descarta o que nao tem equivalente", () => {
    // Emoji e cirilico nao viram nada parecido; inventar transliteracao seria
    // pior que remover.
    const limpo = sanitizeFiscalText("entrega ok \u{1F4E6} confirmada");

    expect(limpo).toBe("entrega ok confirmada");
    expect(limpo).toMatch(PADRAO_XSD);
  });

  it("e idempotente", () => {
    // Ele roda no controller (antes de medir o tamanho) e de novo no service.
    const uma = sanitizeFiscalText("Rua A, 320 — sala 2");
    expect(sanitizeFiscalText(uma)).toBe(uma);
  });
});
