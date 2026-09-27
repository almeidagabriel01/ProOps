import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatStageSchedule,
  scheduleFormFrom,
  toScheduleInput,
} from "../stage-schedule";

/** Horário local: montado pelo mesmo relógio que o teste roda. */
const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).toISOString();

describe("data da visita na tela", () => {
  it("com horário: dia da semana, dia, início e fim", () => {
    expect(
      formatStageSchedule({
        isAllDay: false,
        startsAt: local(2026, 10, 21, 8),
        endsAt: local(2026, 10, 21, 11),
        startDate: null,
      }),
    ).toBe("qua, 21/10, 08:00 às 11:00");
  });

  it("dia inteiro", () => {
    expect(formatStageSchedule({ isAllDay: true, startsAt: null, endsAt: null, startDate: "2026-10-20" })).toBe(
      "ter, 20/10, dia inteiro",
    );
  });

  it("visita que atravessa o dia mostra a data do fim", () => {
    expect(
      formatStageSchedule({
        isAllDay: false,
        startsAt: local(2026, 10, 21, 20),
        endsAt: local(2026, 10, 22, 2),
        startDate: null,
      }),
    ).toBe("qua, 21/10, 20:00 até 22/10 02:00");
  });
});

describe("formulário da visita", () => {
  it("sem visita: amanhã às 08:00, por 2 horas", () => {
    expect(scheduleFormFrom(null, new Date(2026, 9, 31, 15))).toEqual({
      date: "2026-11-01",
      time: "08:00",
      durationMin: 120,
      isAllDay: false,
    });
  });

  it("remarcar parte da visita marcada, com a duração dela", () => {
    expect(
      scheduleFormFrom({
        isAllDay: false,
        startsAt: local(2026, 10, 21, 9, 30),
        endsAt: local(2026, 10, 21, 12, 30),
        startDate: null,
      }),
    ).toEqual({ date: "2026-10-21", time: "09:30", durationMin: 180, isAllDay: false });
  });

  it("com horário: início e fim pela duração", () => {
    expect(toScheduleInput({ date: "2026-10-21", time: "08:00", durationMin: 180, isAllDay: false })).toEqual({
      isAllDay: false,
      startsAt: local(2026, 10, 21, 8),
      endsAt: local(2026, 10, 21, 11),
    });
  });

  it("dia inteiro: termina no dia seguinte, inclusive na virada do mês", () => {
    expect(toScheduleInput({ date: "2026-10-31", time: "", durationMin: 120, isAllDay: true })).toEqual({
      isAllDay: true,
      startDate: "2026-10-31",
      endDate: "2026-11-01",
    });
  });

  it("sem data ou sem hora: nada a enviar", () => {
    expect(toScheduleInput({ date: "", time: "08:00", durationMin: 120, isAllDay: false })).toBeNull();
    expect(toScheduleInput({ date: "2026-10-21", time: "", durationMin: 120, isAllDay: false })).toBeNull();
  });

  it("duração por extenso", () => {
    expect(formatDuration(60)).toBe("1 hora");
    expect(formatDuration(180)).toBe("3 horas");
    expect(formatDuration(90)).toBe("1h30");
    expect(formatDuration(45)).toBe("45 min");
  });
});
