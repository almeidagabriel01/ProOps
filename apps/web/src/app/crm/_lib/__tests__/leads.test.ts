import { describe, expect, it } from "vitest";
import {
  groupLeadsByStage,
  nextActionState,
  openPipelineValue,
  todayInBrazil,
} from "../leads";
import type { Lead } from "@/services/leads-service";

const lead = (over: Partial<Lead>): Lead => ({
  id: "l",
  name: "Lead",
  phone: null,
  email: null,
  company: null,
  source: "outro",
  stage: "novo",
  estimatedValue: null,
  notes: null,
  nextAction: null,
  nextActionAt: null,
  lostReason: null,
  clientId: null,
  ownerId: null,
  ownerName: null,
  createdAt: null,
  updatedAt: null,
  ...over,
});

describe("groupLeadsByStage", () => {
  it("põe cada lead na coluna da etapa e deixa as vazias presentes", () => {
    const groups = groupLeadsByStage([
      lead({ id: "a", stage: "contato" }),
      lead({ id: "b", stage: "perdido" }),
    ]);
    expect(groups.contato.map((l) => l.id)).toEqual(["a"]);
    expect(groups.perdido.map((l) => l.id)).toEqual(["b"]);
    expect(groups.novo).toEqual([]);
    expect(Object.keys(groups)).toEqual(["novo", "contato", "qualificado", "convertido", "perdido"]);
  });
});

describe("nextActionState", () => {
  const today = "2026-09-25";
  it("classifica atrasada, hoje e futura", () => {
    expect(nextActionState(lead({ nextActionAt: "2026-09-24" }), today)).toBe("overdue");
    expect(nextActionState(lead({ nextActionAt: today }), today)).toBe("today");
    expect(nextActionState(lead({ nextActionAt: "2026-09-30" }), today)).toBe("upcoming");
  });

  it("lead fechado ou sem data não cobra ação", () => {
    expect(nextActionState(lead({ nextActionAt: "2026-09-01", stage: "perdido" }), today)).toBeNull();
    expect(nextActionState(lead({ nextActionAt: "2026-09-01", stage: "convertido" }), today)).toBeNull();
    expect(nextActionState(lead({}), today)).toBeNull();
  });
});

describe("openPipelineValue", () => {
  it("soma só os abertos", () => {
    expect(
      openPipelineValue([
        lead({ stage: "novo", estimatedValue: 1000 }),
        lead({ stage: "qualificado", estimatedValue: 500 }),
        lead({ stage: "convertido", estimatedValue: 9000 }),
        lead({ stage: "perdido", estimatedValue: 9000 }),
        lead({ stage: "contato" }),
      ]),
    ).toBe(1500);
  });
});

describe("todayInBrazil", () => {
  it("usa o fuso de Brasília, não UTC", () => {
    expect(todayInBrazil(new Date("2026-09-25T02:00:00.000Z"))).toBe("2026-09-24");
  });
});
