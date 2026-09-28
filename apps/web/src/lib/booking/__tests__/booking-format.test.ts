import { describe, expect, it } from "vitest";
import {
  defaultBookingSettings,
  defaultVisitTypes,
} from "../../../../../functions/src/api/services/booking/booking-model";
import { NICHE_CONFIGS } from "@/lib/niches/config";
import type { TenantNiche } from "@/types";
import {
  demoBookingSettings,
  describeBookingWhen,
  formatDuration,
  formatMinutes,
  groupStartsByPeriod,
  longDayLabel,
  monthGrid,
  monthLabel,
  parseMinutes,
  shiftMonth,
  shortDayLabel,
  weekdayOf,
} from "../booking-format";

describe("formato do agendamento", () => {
  it("minutos do dia viram hora e voltam", () => {
    expect(formatMinutes(570)).toBe("09:30");
    expect(formatMinutes(0)).toBe("00:00");
    expect(parseMinutes("09:30")).toBe(570);
    expect(parseMinutes("9:05")).toBe(545);
    expect(parseMinutes("25:00")).toBeNull();
    expect(parseMinutes("abc")).toBeNull();
  });

  it("dia da semana pela data, sem depender do fuso de quem abre", () => {
    expect(weekdayOf("2026-09-26")).toBe(6);
    expect(weekdayOf("2026-09-28")).toBe(1);
  });

  it("descreve o pedido por extenso e o dia de forma curta", () => {
    expect(describeBookingWhen("2026-09-28", 600)).toBe("segunda-feira, 28/09 às 10:00");
    expect(shortDayLabel("2026-09-26")).toEqual({ weekday: "sáb", day: "26/09" });
  });
});

describe("paridade com o backend", () => {
  const niches = Object.keys(NICHE_CONFIGS) as TenantNiche[];

  it.each(niches)("o tipo de visita padrão de %s é o mesmo dos dois lados", (niche) => {
    expect([NICHE_CONFIGS[niche].booking.defaultVisitType]).toEqual(defaultVisitTypes(niche));
  });

  it.each(niches)("o expediente da demonstração de %s é o padrão do backend", (niche) => {
    const backend: Record<string, unknown> = { ...defaultBookingSettings(niche) };
    delete backend.ownerUserId;
    delete backend.updatedAt;
    expect(demoBookingSettings(NICHE_CONFIGS[niche].booking.defaultVisitType)).toEqual(backend);
  });
});

describe("calendário da página do cliente", () => {
  it("duração curta em minutos, longa em horas", () => {
    expect(formatDuration(30)).toBe("30 min");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(90)).toBe("1h30");
  });

  it("dia por extenso e mês com ano", () => {
    expect(longDayLabel("2026-09-30")).toBe("quarta-feira, 30 de setembro");
    expect(longDayLabel("2026-10-01")).toBe("quinta-feira, 1 de outubro");
    expect(monthLabel("2026-03")).toBe("março de 2026");
  });

  it("anda de mês, virando o ano", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("a grade começa no domingo e põe o dia 1 na coluna dele", () => {
    // 1º de setembro de 2026 é uma terça: duas casas vazias antes.
    const grid = monthGrid("2026-09");
    expect(grid.slice(0, 3)).toEqual([null, null, "2026-09-01"]);
    expect(grid.filter(Boolean)).toHaveLength(30);
    expect(grid.at(-1)).toBe("2026-09-30");
    // Fevereiro de 2028 é bissexto.
    expect(monthGrid("2028-02").filter(Boolean)).toHaveLength(29);
  });

  it("agrupa os horários em manhã, tarde e noite, sem grupo vazio", () => {
    expect(groupStartsByPeriod([540, 690, 720, 1020, 1080])).toEqual([
      { id: "manha", label: "Manhã", starts: [540, 690] },
      { id: "tarde", label: "Tarde", starts: [720, 1020] },
      { id: "noite", label: "Noite", starts: [1080] },
    ]);
    expect(groupStartsByPeriod([780]).map((g) => g.id)).toEqual(["tarde"]);
  });
});
