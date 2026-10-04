import {
  graceLastDay,
  manualPhase,
  pastDueSinceFor,
  periodEndDay,
} from "../manual-subscription-phase";

describe("periodEndDay", () => {
  it("le o dia dos dois formatos gravados", () => {
    expect(periodEndDay("2027-09-14")).toBe("2027-09-14");
    // O writer grava o ISO da meia-noite UTC: em Brasilia seria o dia 13.
    expect(periodEndDay("2027-09-14T00:00:00.000Z")).toBe("2027-09-14");
  });

  it("aceita Date e Timestamp", () => {
    expect(periodEndDay(new Date("2027-09-14"))).toBe("2027-09-14");
    expect(periodEndDay({ toDate: () => new Date("2027-09-14T00:00:00Z") })).toBe("2027-09-14");
  });

  it("sem data valida devolve null", () => {
    expect(periodEndDay("")).toBeNull();
    expect(periodEndDay("amanha")).toBeNull();
    expect(periodEndDay(undefined)).toBeNull();
    expect(periodEndDay(123)).toBeNull();
  });
});

describe("manualPhase", () => {
  const END = "2027-09-14";

  it("o dia do vencimento ainda e ativo (data inclusiva)", () => {
    expect(manualPhase(END, "2027-08-15")).toBe("active");
    expect(manualPhase(END, "2027-09-14")).toBe("active");
  });

  it("do dia seguinte ate o setimo e carencia", () => {
    expect(manualPhase(END, "2027-09-15")).toBe("past_due");
    expect(manualPhase(END, "2027-09-21")).toBe("past_due");
  });

  it("no oitavo dia o plano acaba", () => {
    expect(manualPhase(END, "2027-09-22")).toBe("canceled");
    expect(manualPhase(END, "2028-01-01")).toBe("canceled");
  });

  it("atravessa a virada do mes e do ano", () => {
    expect(manualPhase("2027-12-31", "2028-01-07")).toBe("past_due");
    expect(manualPhase("2027-12-31", "2028-01-08")).toBe("canceled");
  });
});

describe("carencia", () => {
  it("ultimo dia de acesso e o setimo depois do vencimento", () => {
    expect(graceLastDay("2027-09-14")).toBe("2027-09-21");
  });

  it("pastDueSince e meia-noite de Brasilia do dia seguinte ao vencimento", () => {
    expect(pastDueSinceFor("2027-09-14")).toBe("2027-09-15T03:00:00.000Z");
  });

  it("a carencia de 7 dias contada do pastDueSince termina com o dia graceLastDay", () => {
    const start = Date.parse(pastDueSinceFor("2027-09-14"));
    const graceMs = 7 * 24 * 60 * 60 * 1000;
    // 21/09 23:59 em Brasilia ainda esta dentro; 22/09 00:01 ja passou.
    expect(Date.parse("2027-09-22T02:59:00.000Z") - start <= graceMs).toBe(true);
    expect(Date.parse("2027-09-22T03:01:00.000Z") - start <= graceMs).toBe(false);
  });
});
