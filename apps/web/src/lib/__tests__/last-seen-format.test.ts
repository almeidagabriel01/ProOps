import { describe, it, expect } from "vitest";
import { formatLastSeen, daysSinceLastSeen } from "../last-seen-format";

const AGORA = Date.parse("2026-09-23T12:00:00.000Z");
const atras = (ms: number) => new Date(AGORA - ms).toISOString();
const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

describe("formatLastSeen", () => {
  it("sem registro diz que nunca acessou", () => {
    expect(formatLastSeen(undefined, AGORA)).toBe("Nunca acessou");
    expect(formatLastSeen("", AGORA)).toBe("Nunca acessou");
    expect(formatLastSeen("data quebrada", AGORA)).toBe("Nunca acessou");
  });

  it("nao promete precisao de minuto: o backend grava a cada 15 min", () => {
    expect(formatLastSeen(atras(2 * MIN), AGORA)).toBe("há menos de 1 hora");
    expect(formatLastSeen(atras(59 * MIN), AGORA)).toBe("há menos de 1 hora");
  });

  it("horas, ontem e dias", () => {
    expect(formatLastSeen(atras(HORA), AGORA)).toBe("há 1 hora");
    expect(formatLastSeen(atras(5 * HORA), AGORA)).toBe("há 5 horas");
    expect(formatLastSeen(atras(DIA), AGORA)).toBe("ontem");
    expect(formatLastSeen(atras(9 * DIA), AGORA)).toBe("há 9 dias");
  });

  it("meses e anos", () => {
    expect(formatLastSeen(atras(45 * DIA), AGORA)).toBe("há 1 mês");
    expect(formatLastSeen(atras(120 * DIA), AGORA)).toBe("há 4 meses");
    expect(formatLastSeen(atras(400 * DIA), AGORA)).toBe("há 1 ano");
  });

  it("data no futuro (relogio torto) nao vira texto negativo", () => {
    expect(formatLastSeen(new Date(AGORA + HORA).toISOString(), AGORA)).toBe(
      "há menos de 1 hora",
    );
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
