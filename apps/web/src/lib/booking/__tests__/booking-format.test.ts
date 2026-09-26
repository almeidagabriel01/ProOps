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
  formatMinutes,
  parseMinutes,
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
