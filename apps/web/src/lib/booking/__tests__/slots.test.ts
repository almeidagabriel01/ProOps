import { describe, it, expect } from "vitest";
import {
  generateSlotStarts,
  intervalsOverlap,
  isSlotAvailable,
  minutesToLabel,
  formatDateStr,
  isWeekend,
  isPastDate,
  isSlotInPast,
} from "../slots";

describe("minutesToLabel", () => {
  it("formata HH:MM com zero à esquerda", () => {
    expect(minutesToLabel(540)).toBe("09:00");
    expect(minutesToLabel(570)).toBe("09:30");
    expect(minutesToLabel(1020)).toBe("17:00");
  });
});

describe("generateSlotStarts", () => {
  it("1h → 09:00..16:00 (último termina 17:00)", () => {
    const s = generateSlotStarts(60);
    expect(s[0]).toBe(540);
    expect(s[s.length - 1]).toBe(960); // 16:00
    expect(s).toHaveLength(8);
  });
  it("30m → 09:00..16:30", () => {
    const s = generateSlotStarts(30);
    expect(s[s.length - 1]).toBe(990); // 16:30
    expect(s).toHaveLength(16);
  });
  it("15m → 09:00..16:45", () => {
    const s = generateSlotStarts(15);
    expect(s[s.length - 1]).toBe(1005); // 16:45
    expect(s).toHaveLength(32);
  });
});

describe("intervalsOverlap", () => {
  it("intervalos adjacentes NÃO sobrepõem", () => {
    expect(intervalsOverlap(540, 600, 600, 660)).toBe(false);
  });
  it("intervalos que se cruzam sobrepõem", () => {
    expect(intervalsOverlap(540, 600, 570, 630)).toBe(true);
  });
  it("contido sobrepõe", () => {
    expect(intervalsOverlap(540, 660, 570, 600)).toBe(true);
  });
});

describe("isSlotAvailable — bloqueio de double-booking", () => {
  const booking = { date: "2026-06-19", startMinutes: 600, endMinutes: 660 }; // 10:00-11:00

  it("o slot exatamente reservado fica indisponível", () => {
    expect(isSlotAvailable(600, 60, [booking])).toBe(false);
  });
  it("slot de 30m que cai dentro da reunião de 1h fica indisponível", () => {
    expect(isSlotAvailable(630, 30, [booking])).toBe(false); // 10:30-11:00
  });
  it("slot de 30m terminando exatamente no início da reunião fica livre", () => {
    expect(isSlotAvailable(570, 30, [booking])).toBe(true); // 09:30-10:00
  });
  it("slot começando exatamente no fim da reunião fica livre", () => {
    expect(isSlotAvailable(660, 60, [booking])).toBe(true); // 11:00-12:00
  });
  it("sem bookings, livre", () => {
    expect(isSlotAvailable(540, 60, [])).toBe(true);
  });
});

describe("helpers de data", () => {
  it("formatDateStr aplica zero à esquerda", () => {
    expect(formatDateStr(2026, 6, 9)).toBe("2026-06-09");
  });
  it("isWeekend detecta sábado/domingo", () => {
    expect(isWeekend(2026, 6, 20)).toBe(true); // sáb
    expect(isWeekend(2026, 6, 21)).toBe(true); // dom
    expect(isWeekend(2026, 6, 19)).toBe(false); // sex
  });
  it("isPastDate compara strings YYYY-MM-DD", () => {
    expect(isPastDate("2026-06-18", "2026-06-19")).toBe(true);
    expect(isPastDate("2026-06-19", "2026-06-19")).toBe(false);
    expect(isPastDate("2026-06-20", "2026-06-19")).toBe(false);
    expect(isPastDate("2026-06-30", "2026-07-01")).toBe(true);
    expect(isPastDate("2026-07-01", "2026-06-30")).toBe(false);
  });
  it("isSlotInPast só no mesmo dia e horário já passado", () => {
    const now = { dateStr: "2026-06-19", minutes: 600 };
    expect(isSlotInPast("2026-06-19", 540, now)).toBe(true);
    expect(isSlotInPast("2026-06-19", 660, now)).toBe(false);
    expect(isSlotInPast("2026-06-20", 540, now)).toBe(false);
    expect(isSlotInPast("2026-06-19", 600, now)).toBe(true);
  });
});
