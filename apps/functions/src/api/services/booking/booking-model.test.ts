import {
  BookingSettingsInputSchema,
  brazilDate,
  brazilToUtcMs,
  busyFromCalendarEvent,
  busyFromExceptions,
  computeAvailableSlots,
  defaultVisitTypes,
  normalizeExceptions,
  visitTypeId,
  weekdayOf,
} from "./booking-model";

// Sexta-feira, 25/09/2026 às 08:00 em Brasília (11:00 UTC).
const NOW = Date.UTC(2026, 8, 25, 11, 0);
const base = { days: [1, 2, 3, 4, 5], startMin: 540, endMin: 720, leadHours: 0, horizonDays: 7 };

describe("horário de Brasília", () => {
  it("09:00 em Brasília é 12:00 UTC", () => {
    expect(new Date(brazilToUtcMs("2026-09-25", 540)).toISOString()).toBe("2026-09-25T12:00:00.000Z");
  });

  it("23:30 de Brasília ainda é o mesmo dia, mesmo já sendo o seguinte em UTC", () => {
    expect(brazilDate(Date.UTC(2026, 8, 26, 2, 30))).toBe("2026-09-25");
  });

  it("dia da semana", () => {
    expect(weekdayOf("2026-09-25")).toBe(5);
    expect(weekdayOf("2026-09-27")).toBe(0);
  });
});

describe("horários livres", () => {
  it("só dias abertos do expediente, com a visita inteira dentro", () => {
    const slots = computeAvailableSlots({ settings: base, durationMin: 60, busy: [], nowMs: NOW });
    expect(slots.map((d) => d.date)).toEqual([
      "2026-09-25",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
    ]);
    // 09:00 a 12:00, visita de 1h: de hora em hora, a última às 11:00.
    expect(slots[0].starts).toEqual([540, 600, 660]);
  });

  it("o passo entre os horários é a duração da visita", () => {
    const at = (durationMin: number) =>
      computeAvailableSlots({ settings: base, durationMin, busy: [], nowMs: NOW })[0].starts;
    // Visita de 1h não aparece às 09:30 nem às 10:30.
    expect(at(60)).not.toContain(570);
    expect(at(30)).toEqual([540, 570, 600, 630, 660, 690]);
    expect(at(90)).toEqual([540, 630]);
    // Visita de 2h: a das 11:00 passaria do fim do expediente (12:00).
    expect(at(120)).toEqual([540]);
  });

  it("compromisso fora da grade derruba só o horário que ele toca, sem deslocar os outros", () => {
    const busy = [{ startMs: brazilToUtcMs("2026-09-25", 570), endMs: brazilToUtcMs("2026-09-25", 600) }];
    const slots = computeAvailableSlots({ settings: base, durationMin: 60, busy, nowMs: NOW });
    // Compromisso das 09:30 às 10:00: cai o das 09:00; os outros seguem na hora cheia.
    expect(slots[0].starts).toEqual([600, 660]);
  });

  it("respeita a antecedência mínima", () => {
    const slots = computeAvailableSlots({
      settings: { ...base, leadHours: 3 },
      durationMin: 60,
      busy: [],
      nowMs: NOW,
    });
    // Agora 08:00 + 3h = 11:00: só sobra o das 11:00 na sexta.
    expect(slots[0]).toEqual({ date: "2026-09-25", starts: [660] });
  });

  it("não oferece horário que encosta num compromisso da Agenda", () => {
    const busy = [{ startMs: brazilToUtcMs("2026-09-25", 600), endMs: brazilToUtcMs("2026-09-25", 660) }];
    const slots = computeAvailableSlots({ settings: base, durationMin: 60, busy, nowMs: NOW });
    // Compromisso das 10:00 às 11:00: cai o das 10:00.
    expect(slots[0].starts).toEqual([540, 660]);
  });

  it("dia inteiro ocupado some da lista", () => {
    const allDay = busyFromCalendarEvent({ isAllDay: true, startDate: "2026-09-25", endDate: "2026-09-26" });
    const slots = computeAvailableSlots({ settings: base, durationMin: 60, busy: [allDay!], nowMs: NOW });
    expect(slots.map((d) => d.date)).not.toContain("2026-09-25");
  });

  it("visita maior que o expediente não tem horário", () => {
    expect(computeAvailableSlots({ settings: base, durationMin: 240, busy: [], nowMs: NOW })).toEqual([]);
  });

  it("compromisso cancelado não ocupa", () => {
    expect(busyFromCalendarEvent({ status: "canceled", startMs: 1, endMs: 2 })).toBeNull();
  });
});

describe("expediente", () => {
  const valid = {
    enabled: true,
    days: [5, 1, 1],
    startMin: 540,
    endMin: 1080,
    leadHours: 24,
    horizonDays: 21,
    visitTypes: [{ label: "Medição", durationMin: 60 }],
  };

  it("aceita e organiza os dias", () => {
    const parsed = BookingSettingsInputSchema.parse(valid);
    expect(parsed.days).toEqual([1, 5]);
  });

  it("fim antes do início é recusado", () => {
    expect(BookingSettingsInputSchema.safeParse({ ...valid, endMin: 480 }).success).toBe(false);
  });

  it("visita que não cabe no expediente é recusada", () => {
    expect(
      BookingSettingsInputSchema.safeParse({
        ...valid,
        startMin: 540,
        endMin: 600,
        visitTypes: [{ label: "Longa", durationMin: 120 }],
      }).success,
    ).toBe(false);
  });

  it("sem dia da semana é recusado", () => {
    expect(BookingSettingsInputSchema.safeParse({ ...valid, days: [] }).success).toBe(false);
  });
});

describe("tipos de visita", () => {
  it("começam pelo nicho", () => {
    expect(defaultVisitTypes("cortinas")[0].label).toBe("Medição");
    expect(defaultVisitTypes("automacao_residencial")[0].label).toBe("Visita técnica");
    expect(defaultVisitTypes("seguranca_eletronica")[0].label).toBe("Vistoria técnica");
  });

  it("id a partir do nome, sem repetir", () => {
    expect(visitTypeId("Visita Técnica", new Set())).toBe("visita_tecnica");
    expect(visitTypeId("Visita Técnica", new Set(["visita_tecnica"]))).toBe("visita_tecnica_2");
  });
});

describe("exceções do expediente", () => {
  // Segunda 28/09 e terça 29/09 de 2026; expediente das 09:00 às 12:00.
  const settings = { ...base, horizonDays: 7 };
  const slotsOn = (date: string, exceptions: Parameters<typeof busyFromExceptions>[0]) =>
    computeAvailableSlots({ settings: { ...settings, exceptions }, durationMin: 60, busy: [], nowMs: NOW }).find(
      (d) => d.date === date,
    )?.starts ?? [];

  it("dia inteiro sem atendimento some da lista", () => {
    expect(slotsOn("2026-09-28", [])).toEqual([540, 600, 660]);
    expect(
      slotsOn("2026-09-28", [{ id: "a", date: "2026-09-28", allDay: true, startMin: null, endMin: null, note: "Feriado" }]),
    ).toEqual([]);
    // O dia seguinte continua aberto.
    expect(
      slotsOn("2026-09-29", [{ id: "a", date: "2026-09-28", allDay: true, startMin: null, endMin: null, note: null }]),
    ).toEqual([540, 600, 660]);
  });

  it("faixa derruba só os horários que ela toca", () => {
    expect(
      slotsOn("2026-09-28", [{ id: "a", date: "2026-09-28", allDay: false, startMin: 600, endMin: 630, note: null }]),
    ).toEqual([540, 660]);
  });

  it("dia inteiro vale em Brasília, de 00:00 às 24:00", () => {
    expect(busyFromExceptions([{ id: "a", date: "2026-09-28", allDay: true, startMin: null, endMin: null, note: null }])).toEqual([
      { startMs: Date.parse("2026-09-28T03:00:00.000Z"), endMs: Date.parse("2026-09-29T03:00:00.000Z") },
    ]);
  });

  it("ao salvar: tira as que passaram, ordena e dá id estável", () => {
    const result = normalizeExceptions(
      [
        { date: "2026-10-02", allDay: false, startMin: 600, endMin: 660, note: "  Médico " },
        { date: "2026-09-20", allDay: true },
        { id: "fer", date: "2026-10-01", allDay: true, startMin: 540, endMin: 600, note: "" },
      ],
      NOW,
    );
    expect(result).toEqual([
      { id: "fer", date: "2026-10-01", allDay: true, startMin: null, endMin: null, note: null },
      { id: "exc_20261002_600", date: "2026-10-02", allDay: false, startMin: 600, endMin: 660, note: "Médico" },
    ]);
  });

  it("a exceção de hoje ainda vale", () => {
    expect(normalizeExceptions([{ date: "2026-09-25", allDay: true }], NOW)).toHaveLength(1);
  });

  it("schema: faixa precisa de início antes do fim, e o campo é opcional", () => {
    const valid = {
      enabled: true,
      days: [1],
      startMin: 540,
      endMin: 720,
      leadHours: 0,
      horizonDays: 7,
      visitTypes: [{ label: "Visita", durationMin: 60 }],
    };
    expect(BookingSettingsInputSchema.safeParse(valid).success).toBe(true);
    expect(
      BookingSettingsInputSchema.safeParse({
        ...valid,
        exceptions: [{ date: "2026-10-01", allDay: false, startMin: 660, endMin: 600 }],
      }).success,
    ).toBe(false);
    expect(
      BookingSettingsInputSchema.safeParse({
        ...valid,
        exceptions: [{ date: "2026-10-01", allDay: true }, { date: "2026-10-02", allDay: false, startMin: 600, endMin: 660, note: "Médico" }],
      }).success,
    ).toBe(true);
    expect(
      BookingSettingsInputSchema.safeParse({ ...valid, exceptions: [{ date: "01/10/2026", allDay: true }] }).success,
    ).toBe(false);
  });
});
