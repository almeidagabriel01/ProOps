import {
  intervalsOverlap,
  isValidDuration,
  isValidSlotStart,
  hasConflict,
} from "../booking-slots";

describe("isValidDuration", () => {
  it("aceita 15/30/60 e rejeita o resto", () => {
    expect(isValidDuration(15)).toBe(true);
    expect(isValidDuration(30)).toBe(true);
    expect(isValidDuration(60)).toBe(true);
    expect(isValidDuration(45)).toBe(false);
    expect(isValidDuration(0)).toBe(false);
  });
});

describe("isValidSlotStart", () => {
  it("aceita início alinhado à grade e dentro do expediente", () => {
    expect(isValidSlotStart(540, 60)).toBe(true); // 09:00
    expect(isValidSlotStart(960, 60)).toBe(true); // 16:00 (termina 17:00)
    expect(isValidSlotStart(570, 30)).toBe(true); // 09:30
  });
  it("rejeita início fora da grade", () => {
    expect(isValidSlotStart(545, 60)).toBe(false);
    expect(isValidSlotStart(570, 60)).toBe(false); // 09:30 não é múltiplo de 60 a partir de 540
  });
  it("rejeita slot que ultrapassa 17:00", () => {
    expect(isValidSlotStart(1020, 60)).toBe(false); // 17:00 início → termina 18:00
    expect(isValidSlotStart(990, 60)).toBe(false); // 16:30 + 60 = 17:30
  });
  it("rejeita antes das 09:00", () => {
    expect(isValidSlotStart(480, 60)).toBe(false); // 08:00
  });
});

describe("intervalsOverlap", () => {
  it("intervalos adjacentes não sobrepõem", () => {
    expect(intervalsOverlap(600, 660, 660, 720)).toBe(false);
  });
  it("intervalos que se cruzam sobrepõem", () => {
    expect(intervalsOverlap(600, 660, 630, 690)).toBe(true);
  });
});

describe("hasConflict", () => {
  const existing = [{ startMinutes: 600, endMinutes: 660 }]; // 10:00-11:00
  it("detecta sobreposição", () => {
    expect(hasConflict(600, 60, existing)).toBe(true);
    expect(hasConflict(630, 30, existing)).toBe(true);
  });
  it("sem sobreposição quando adjacente", () => {
    expect(hasConflict(540, 60, existing)).toBe(false); // 09:00-10:00
    expect(hasConflict(660, 60, existing)).toBe(false); // 11:00-12:00
  });
  it("sem bookings → sem conflito", () => {
    expect(hasConflict(600, 60, [])).toBe(false);
  });
});
