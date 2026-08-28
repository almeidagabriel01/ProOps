import { brasiliaDatePart, toBrasiliaIso } from "./fiscal-datetime";

/**
 * Reproduz a rejeição E0008 real.
 *
 * A DPS foi enviada com `<dhEmi>2026-08-28T03:08:00+00:00</dhEmi>` e processada
 * às `2026-08-28T00:08:05.336-03:00`. Mesmo instante, emissão 5 segundos antes
 * — e mesmo assim: "A data de emissão da DPS não pode ser posterior à data do
 * seu processamento". O Ambiente Nacional comparou os relógios de parede.
 */

describe("toBrasiliaIso", () => {
  it("converte o instante que causou a rejeição E0008", () => {
    const instante = new Date("2026-08-28T03:08:00.000Z");

    expect(toBrasiliaIso(instante)).toBe("2026-08-28T00:08:00-03:00");
  });

  it("o horário de parede fica antes do processamento informado pelo fisco", () => {
    // É esta comparação — a ingênua, de texto — que o Ambiente Nacional faz.
    const emissao = toBrasiliaIso(new Date("2026-08-28T03:08:00.000Z"));
    const processamento = "2026-08-28T00:08:05.3364148-03:00";

    expect(emissao < processamento).toBe(true);
  });

  it("sempre carrega o deslocamento explícito, nunca Z", () => {
    // Sem o offset, o leitor assume o fuso dele — e o Cloud Run roda em UTC.
    expect(toBrasiliaIso(new Date("2026-01-01T12:00:00.000Z"))).toMatch(/-03:00$/);
    expect(toBrasiliaIso(new Date("2026-01-01T12:00:00.000Z"))).not.toContain("Z");
  });

  it("atravessa a virada do dia corretamente", () => {
    // 00:30 UTC é 21:30 do dia ANTERIOR em Brasília.
    expect(toBrasiliaIso(new Date("2026-08-28T00:30:00.000Z"))).toBe(
      "2026-08-27T21:30:00-03:00",
    );
  });

  it("não aplica horário de verão", () => {
    // O Brasil não tem mais desde o Decreto 9.772/2019. Janeiro seria o mês
    // afetado se tivesse.
    expect(toBrasiliaIso(new Date("2026-01-15T15:00:00.000Z"))).toBe(
      "2026-01-15T12:00:00-03:00",
    );
  });
});

describe("brasiliaDatePart", () => {
  it("não adianta o dia em nota emitida à noite", () => {
    // 22h de Brasília é 01h UTC do dia seguinte. `slice(0, 10)` do ISO em UTC
    // mandaria a competência para 29/08 — erro que só aparece entre 21h e
    // meia-noite, exatamente quando ninguém testa.
    expect(brasiliaDatePart("2026-08-29T01:00:00.000Z")).toBe("2026-08-28");
  });

  it("aceita ISO que já vem com o deslocamento de Brasília", () => {
    // Idempotente: `dataEmissao` já é gerada por `toBrasiliaIso`.
    expect(brasiliaDatePart("2026-08-28T00:08:05-03:00")).toBe("2026-08-28");
  });

  it("preserva uma data de calendário em vez de recuar um dia", () => {
    // `YYYY-MM-DD` puro não é um instante. `new Date("2026-08-28")` é meia-noite
    // em UTC, e o deslocamento devolveria 27/08 — piorando uma data correta.
    expect(brasiliaDatePart("2026-08-28")).toBe("2026-08-28");
  });

  it("degrada sem quebrar diante de entrada inválida", () => {
    // Emissão não pode cair por causa de um formato inesperado; o provedor
    // valida o formato de novo do lado dele.
    expect(brasiliaDatePart("nao-e-data-valida")).toBe("nao-e-data");
    expect(brasiliaDatePart("")).toBe("");
  });
});
