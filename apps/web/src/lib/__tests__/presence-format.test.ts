import { describe, it, expect } from "vitest";
import {
  describeAccess,
  describePresence,
  formatPresenceTime,
  formatSessionDuration,
} from "../presence-format";

/**
 * O texto que responde "está aí ou já saiu?" no painel do super admin, no
 * fuso de Brasília.
 */

const NOW = Date.parse("2026-10-07T14:00:00.000Z"); // 11:00 em Brasília

describe("describePresence", () => {
  it("entrou 10:15 e continua online", () => {
    expect(
      describePresence(
        { status: "online", sessionStartedAt: "2026-10-07T13:15:00.000Z", lastHeartbeatAt: "2026-10-07T13:59:00.000Z" },
        NOW,
      ),
    ).toBe("Online desde 10:15");
  });

  it("aba aberta sem uso", () => {
    expect(
      describePresence(
        { status: "away", sessionStartedAt: "2026-10-07T13:15:00.000Z", lastHeartbeatAt: "2026-10-07T13:59:00.000Z" },
        NOW,
      ),
    ).toBe("Ausente, entrou 10:15");
  });

  it("entrou 10:15, olhou algo e saiu às 10:20", () => {
    expect(
      describePresence(
        { status: "offline", sessionStartedAt: "2026-10-07T13:15:00.000Z", lastHeartbeatAt: "2026-10-07T13:20:00.000Z" },
        NOW,
      ),
    ).toBe("Saiu 10:20, ficou 5 min");
  });

  it("sessão de outro dia mostra a data", () => {
    expect(
      describePresence(
        { status: "offline", sessionStartedAt: "2026-10-06T12:00:00.000Z", lastHeartbeatAt: "2026-10-06T14:05:00.000Z" },
        NOW,
      ),
    ).toBe("Saiu 06/10 11:05, ficou 2 h 05");
  });

  it("sem aviso de presença, nada", () => {
    expect(describePresence(undefined, NOW)).toBe("");
    expect(describePresence({ status: "offline", sessionStartedAt: null, lastHeartbeatAt: null }, NOW)).toBe("");
  });
});

describe("formatSessionDuration e formatPresenceTime", () => {
  it("duração", () => {
    expect(formatSessionDuration(0)).toBe("menos de 1 min");
    expect(formatSessionDuration(5)).toBe("5 min");
    expect(formatSessionDuration(120)).toBe("2 h");
    expect(formatSessionDuration(65)).toBe("1 h 05");
  });

  it("virada do dia é a de Brasília, não a de UTC", () => {
    // 01:30 UTC do dia 8 ainda é 22:30 do dia 7 em Brasília.
    expect(formatPresenceTime("2026-10-08T01:30:00.000Z", Date.parse("2026-10-08T02:00:00.000Z"))).toBe("22:30");
  });
});

describe("describeAccess: último acesso e presença numa linha só", () => {
  const sessao = { sessionStartedAt: "2026-10-07T13:15:00.000Z", lastHeartbeatAt: "2026-10-07T13:59:00.000Z" };

  it("caso do print: voltou para a aba às 10:19 numa sessão que começou 10:15, e só aparece a sessão", () => {
    expect(describeAccess("2026-10-07T13:19:00.000Z", { status: "online", ...sessao }, NOW)).toEqual({
      primary: "Online agora",
      secondary: "desde 10:15",
      status: "online",
      stale: false,
    });
  });

  it("ausente", () => {
    expect(describeAccess("2026-10-07T13:15:00.000Z", { status: "away", ...sessao }, NOW)).toMatchObject({
      primary: "Ausente",
      secondary: "entrou 10:15, sem mexer",
    });
  });

  it("saiu: a hora da saída, dita como saída, e quanto ficou", () => {
    const saiu = { status: "offline" as const, sessionStartedAt: "2026-10-07T13:15:00.000Z", lastHeartbeatAt: "2026-10-07T13:20:00.000Z" };
    expect(describeAccess("2026-10-07T13:15:00.000Z", saiu, NOW)).toEqual({
      primary: "07/10/2026 às 10:20",
      secondary: "saiu há 40 min, ficou 5 min",
      status: "offline",
      stale: false,
    });
  });

  it("acesso mais novo que a última sessão (aba sem presença): vale o acesso, dito como entrada", () => {
    const antiga = { status: "offline" as const, sessionStartedAt: "2026-10-01T13:00:00.000Z", lastHeartbeatAt: "2026-10-01T13:10:00.000Z" };
    expect(describeAccess("2026-10-07T13:50:00.000Z", antiga, NOW)).toMatchObject({
      primary: "07/10/2026 às 10:50",
      secondary: "entrou há 10 min",
      status: null,
    });
  });

  it("empresa sem presença registrada continua com o último acesso de antes", () => {
    expect(describeAccess("2026-10-07T13:30:00.000Z", undefined, NOW)).toMatchObject({
      primary: "07/10/2026 às 10:30",
      secondary: "entrou há 30 min",
      status: null,
      stale: false,
    });
  });

  it("entrada ou saída de outro dia: \"entrou ontem\", \"saiu ontem\"", () => {
    expect(describeAccess("2026-10-06T13:00:00.000Z", undefined, NOW).secondary).toBe("entrou ontem");
    const ontem = { status: "offline" as const, sessionStartedAt: "2026-10-06T13:00:00.000Z", lastHeartbeatAt: "2026-10-06T13:30:00.000Z" };
    expect(describeAccess("2026-10-06T13:00:00.000Z", ontem, NOW).secondary).toBe("saiu ontem, ficou 30 min");
  });

  it("nunca acessou, ou há 30 dias ou mais, fica destacado", () => {
    expect(describeAccess(undefined, undefined, NOW)).toMatchObject({ primary: "Nunca acessou", secondary: "", stale: true });
    expect(describeAccess("2026-09-01T13:00:00.000Z", undefined, NOW).stale).toBe(true);
  });
});
