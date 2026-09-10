/**
 * Numeracao de proposta: montagem do codigo e alocacao do sequencial.
 *
 * Os cenarios sao os do cliente que pediu a funcionalidade
 * (`0018526SP_casa_do_mauricio`), mais os que erram em silencio: praca digitada
 * de tres jeitos diferentes, virada de ano com e sem reinicio, e config vinda
 * de um documento gravado antes de o campo existir.
 */

import {
  DEFAULT_NUMBERING_CONFIG,
  MAX_PRACAS,
  allocateNextNumber,
  buildProposalCode,
  normalizePraca,
  sanitizeNumberingConfig,
  slugifyProposalTitle,
} from "./proposal-numbering";

describe("buildProposalCode", () => {
  it("monta o formato do cliente: 5 digitos, ano de 2 digitos, praca", () => {
    expect(buildProposalCode({ number: 185, year: 2026, praca: "SP" })).toBe(
      "0018526SP",
    );
  });

  it("mantem o codigo sem praca quando a empresa nao usa praca", () => {
    expect(buildProposalCode({ number: 185, year: 2026, praca: null })).toBe(
      "0018526",
    );
  });

  it("respeita a quantidade de digitos configurada", () => {
    expect(
      buildProposalCode({ number: 7, year: 2026, praca: "RJ", digits: 3 }),
    ).toBe("00726RJ");
  });

  it("nao trunca o sequencial que passa da largura configurada", () => {
    // Preferir um codigo mais largo a devolver um numero ERRADO: 123456 com 5
    // digitos e 123456, nunca 23456.
    expect(
      buildProposalCode({ number: 123456, year: 2026, praca: "SP", digits: 5 }),
    ).toBe("12345626SP");
  });

  it("preserva o zero a esquerda do ano", () => {
    expect(buildProposalCode({ number: 1, year: 2007, praca: "SP" })).toBe(
      "0000107SP",
    );
  });
});

describe("normalizePraca", () => {
  it("reduz as variantes de digitacao a mesma sigla", () => {
    for (const entrada of ["SP", "sp", "S.P.", " Sp "]) {
      expect(normalizePraca(entrada)).toBe("SP");
    }
  });

  it("remove acento em vez de descartar a letra", () => {
    expect(normalizePraca("são")).toBe("SAO");
  });

  it("devolve string vazia para valor ausente", () => {
    expect(normalizePraca(null)).toBe("");
    expect(normalizePraca(undefined)).toBe("");
  });
});

describe("sanitizeNumberingConfig", () => {
  it("nasce desligada quando nao ha nada gravado", () => {
    expect(sanitizeNumberingConfig(undefined)).toEqual({
      ...DEFAULT_NUMBERING_CONFIG,
      year: expect.any(Number),
    });
    expect(sanitizeNumberingConfig(undefined).enabled).toBe(false);
  });

  it("dedupe as pracas depois de normalizar", () => {
    const config = sanitizeNumberingConfig({
      pracas: ["SP", "sp", "S.P.", "RJ"],
    });
    expect(config.pracas).toEqual(["SP", "RJ"]);
  });

  it("limita o tamanho da lista de pracas", () => {
    const muitas = Array.from({ length: MAX_PRACAS + 10 }, (_, i) => `P${i}`);
    expect(sanitizeNumberingConfig({ pracas: muitas }).pracas).toHaveLength(
      MAX_PRACAS,
    );
  });

  it("descarta praca padrao que nao esta na lista", () => {
    const config = sanitizeNumberingConfig({
      pracas: ["SP"],
      defaultPraca: "RJ",
    });
    expect(config.defaultPraca).toBeNull();
  });

  it("aceita praca padrao presente na lista, normalizando", () => {
    const config = sanitizeNumberingConfig({
      pracas: ["SP", "RJ"],
      defaultPraca: "rj",
    });
    expect(config.defaultPraca).toBe("RJ");
  });

  it("prende os digitos na faixa suportada", () => {
    expect(sanitizeNumberingConfig({ digits: 0 }).digits).toBe(1);
    expect(sanitizeNumberingConfig({ digits: 99 }).digits).toBe(10);
    expect(sanitizeNumberingConfig({ digits: "abc" }).digits).toBe(5);
  });

  it("nunca deixa o proximo numero abaixo de 1", () => {
    expect(sanitizeNumberingConfig({ nextNumber: 0 }).nextNumber).toBe(1);
    expect(sanitizeNumberingConfig({ nextNumber: -5 }).nextNumber).toBe(1);
  });

  it("aceita comecar de onde a empresa ja estava", () => {
    // O caso real: o cliente ja emitiu 185 propostas fora do ERP.
    expect(sanitizeNumberingConfig({ nextNumber: 186 }).nextNumber).toBe(186);
  });
});

describe("allocateNextNumber", () => {
  const base = {
    ...DEFAULT_NUMBERING_CONFIG,
    enabled: true,
    nextNumber: 185,
    year: 2026,
  };

  it("entrega o proximo numero e avanca o contador", () => {
    const alocado = allocateNextNumber(base, 2026);
    expect(alocado.number).toBe(185);
    expect(alocado.year).toBe(2026);
    expect(alocado.nextState).toEqual({ nextNumber: 186, year: 2026 });
  });

  it("atravessa o ano quando a sequencia e continua", () => {
    const alocado = allocateNextNumber({ ...base, resetYearly: false }, 2027);
    expect(alocado.number).toBe(185);
    expect(alocado.nextState).toEqual({ nextNumber: 186, year: 2027 });
  });

  it("reinicia em 1 na virada do ano quando configurado", () => {
    const alocado = allocateNextNumber({ ...base, resetYearly: true }, 2027);
    expect(alocado.number).toBe(1);
    expect(alocado.nextState).toEqual({ nextNumber: 2, year: 2027 });
  });

  it("nao reinicia duas vezes no mesmo ano", () => {
    const primeira = allocateNextNumber({ ...base, resetYearly: true }, 2027);
    const segunda = allocateNextNumber(
      { ...base, resetYearly: true, ...primeira.nextState },
      2027,
    );
    expect(segunda.number).toBe(2);
  });

  it("nao devolve o numero de uma proposta apagada", () => {
    // O contador so avanca. Renumerar as seguintes mudaria o identificador de
    // um documento que o cliente ja recebeu.
    const primeira = allocateNextNumber(base, 2026);
    const segunda = allocateNextNumber(
      { ...base, ...primeira.nextState },
      2026,
    );
    expect(segunda.number).toBe(186);
  });
});

describe("slugifyProposalTitle", () => {
  it("produz o sufixo do nome do arquivo no formato do cliente", () => {
    expect(slugifyProposalTitle("Casa do Mauricio")).toBe("casa_do_mauricio");
  });

  it("remove acento e pontuacao em vez de deixar no nome do arquivo", () => {
    expect(slugifyProposalTitle("Residência São João - Fase 2")).toBe(
      "residencia_sao_joao_fase_2",
    );
  });

  it("nao deixa separador sobrando nas pontas", () => {
    expect(slugifyProposalTitle("  ...Casa...  ")).toBe("casa");
  });

  it("devolve vazio para titulo ausente", () => {
    expect(slugifyProposalTitle(null)).toBe("");
  });
});
