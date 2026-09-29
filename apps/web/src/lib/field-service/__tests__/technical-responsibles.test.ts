import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  ART_EXPIRING_DAYS,
  ART_MAX_BYTES,
  artStatus,
  sortResponsibles,
  todayInBrazil,
} from "../technical-responsibles";
import type { TechnicalResponsible } from "@/types/field-service";

describe("artStatus", () => {
  it("sem data, vencida, vencendo em 30 dias e válida", () => {
    expect(artStatus(null, "2026-09-29")).toBe("missing");
    expect(artStatus("2026-09-28", "2026-09-29")).toBe("expired");
    expect(artStatus("2026-09-29", "2026-09-29")).toBe("expiring");
    expect(artStatus("2026-10-29", "2026-09-29")).toBe("expiring");
    expect(artStatus("2026-10-30", "2026-09-29")).toBe("valid");
  });

  it("vira o mês e o ano", () => {
    expect(artStatus("2027-01-14", "2026-12-15")).toBe("expiring");
    expect(artStatus("2027-01-15", "2026-12-15")).toBe("valid");
  });
});

it("a régua e o teto do PDF são os mesmos do backend", () => {
  const backend = readFileSync(
    path.resolve(__dirname, "../../../../../functions/src/api/services/field-service/technical-responsible-model.ts"),
    "utf8",
  );
  expect(backend).toContain(`ART_EXPIRING_DAYS = ${ART_EXPIRING_DAYS};`);
  expect(backend).toContain(`ART_MAX_BYTES = ${ART_MAX_BYTES / 1024} * 1024;`);
});

it("ativos primeiro, depois por nome", () => {
  const base = { tenantId: "t", profession: "", council: "CREA", registryNumber: "", artNumber: null, artValidUntil: null, artFile: null } as const;
  const list: TechnicalResponsible[] = [
    { ...base, id: "1", name: "Bruno", active: false },
    { ...base, id: "2", name: "Carla", active: true },
    { ...base, id: "3", name: "Álvaro", active: true },
  ];
  expect(sortResponsibles(list).map((r) => r.name)).toEqual(["Álvaro", "Carla", "Bruno"]);
});

it("hoje no fuso de Brasília", () => {
  expect(todayInBrazil(new Date("2026-09-30T02:00:00Z"))).toBe("2026-09-29");
  expect(todayInBrazil(new Date("2026-09-30T03:00:00Z"))).toBe("2026-09-30");
});
