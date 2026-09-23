import { describe, it, expect } from "vitest";
import {
  formatLastSeen,
  formatLastSeenExact,
  daysSinceLastSeen,
} from "../last-seen-format";

const AGORA = Date.parse("2026-09-23T17:32:00.000Z"); // 14:32 em Brasília
const atras = (ms: number) => new Date(AGORA - ms).toISOString();
const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

describe("formatLastSeenExact", () => {
  it("dia e horario exatos, no fuso de Brasilia", () => {
    expect(formatLastSeenExact("2026-09-23T17:32:00.000Z")).toBe("23/09/2026 às 14:32");
  });

  it("virada de dia respeita Brasilia, nao UTC", () => {
    // 01:10 UTC do dia 24 ainda e 22:10 do dia 23 em Brasilia.
    expect(formatLastSeenExact("2026-09-24T01:10:00.000Z")).toBe("23/09/2026 às 22:10");
  });

  it("sem registro diz que nunca acessou", () => {
    expect(formatLastSeenExact(undefined)).toBe("Nunca acessou");
    expect(formatLastSeenExact("data quebrada")).toBe("Nunca acessou");
  });
});

describe("formatLastSeen (relativo)", () => {
  it("precisao de minuto: nao arredonda mais para 'menos de 1 hora'", () => {
    expect(formatLastSeen(atras(20 * 1000), AGORA)).toBe("agora");
    expect(formatLastSeen(atras(MIN), AGORA)).toBe("há 1 min");
    expect(formatLastSeen(atras(12 * MIN), AGORA)).toBe("há 12 min");
    expect(formatLastSeen(atras(59 * MIN), AGORA)).toBe("há 59 min");
  });

  it("horas, ontem e dias", () => {
    expect(formatLastSeen(atras(HORA), AGORA)).toBe("há 1 h");
    expect(formatLastSeen(atras(5 * HORA), AGORA)).toBe("há 5 h");
    expect(formatLastSeen(atras(DIA), AGORA)).toBe("ontem");
    expect(formatLastSeen(atras(9 * DIA), AGORA)).toBe("há 9 dias");
  });

  it("meses e anos", () => {
    expect(formatLastSeen(atras(45 * DIA), AGORA)).toBe("há 1 mês");
    expect(formatLastSeen(atras(120 * DIA), AGORA)).toBe("há 4 meses");
    expect(formatLastSeen(atras(400 * DIA), AGORA)).toBe("há 1 ano");
  });

  it("sem registro fica vazio (a linha exata ja diz 'Nunca acessou')", () => {
    expect(formatLastSeen(undefined, AGORA)).toBe("");
  });

  it("data no futuro (relogio torto) vira 'agora', nao texto negativo", () => {
    expect(formatLastSeen(new Date(AGORA + HORA).toISOString(), AGORA)).toBe("agora");
  });
});

describe("daysSinceLastSeen", () => {
  it("sem registro devolve null, para a tela destacar", () => {
    expect(daysSinceLastSeen(undefined, AGORA)).toBeNull();
  });

  it("conta dias completos", () => {
    expect(daysSinceLastSeen(atras(5 * HORA), AGORA)).toBe(0);
    expect(daysSinceLastSeen(atras(31 * DIA), AGORA)).toBe(31);
  });
});
