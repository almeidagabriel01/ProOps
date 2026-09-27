import {
  ScheduleStageSchema,
  nextScheduledStage,
  publicSchedule,
  scheduleChanged,
  scheduleEventDescription,
  scheduleEventTitle,
  stageScheduleFromEvent,
} from "./project-schedule";
import type { StageSchedule } from "./project-model";

const event = {
  status: "scheduled",
  isAllDay: false,
  startsAt: "2026-10-20T11:00:00.000Z",
  endsAt: "2026-10-20T14:00:00.000Z",
  startDate: null,
  endDate: null,
  startMs: Date.parse("2026-10-20T11:00:00.000Z"),
  endMs: Date.parse("2026-10-20T14:00:00.000Z"),
};

function schedule(startIso: string, hours = 2): StageSchedule {
  const startMs = Date.parse(startIso);
  return {
    eventId: `ev-${startIso}`,
    isAllDay: false,
    startsAt: startIso,
    endsAt: new Date(startMs + hours * 3600_000).toISOString(),
    startDate: null,
    endDate: null,
    startMs,
    endMs: startMs + hours * 3600_000,
  };
}

describe("espelho da data na etapa", () => {
  it("copia a data do evento, com o id dele", () => {
    expect(stageScheduleFromEvent("ev1", event)).toEqual({
      eventId: "ev1",
      isAllDay: false,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      startDate: null,
      endDate: null,
      startMs: event.startMs,
      endMs: event.endMs,
    });
  });

  it("evento cancelado: a etapa fica sem data", () => {
    expect(stageScheduleFromEvent("ev1", { ...event, status: "canceled" })).toBeNull();
  });

  it("concluído continua mostrando a data", () => {
    expect(stageScheduleFromEvent("ev1", { ...event, status: "completed" })).not.toBeNull();
  });
});

describe("texto do evento", () => {
  it("título 'Etapa: obra', no limite de 140 da Agenda", () => {
    expect(scheduleEventTitle(" Instalação ", "Casa Silva ")).toBe("Instalação: Casa Silva");
    expect(scheduleEventTitle("Instalação", "x".repeat(200))).toHaveLength(140);
  });

  it("descrição com cliente, telefone, técnico e o link da obra, sem linha vazia", () => {
    expect(
      scheduleEventDescription({
        clientName: "Ana",
        clientPhone: null,
        assigneeName: "Carlos",
        projectUrl: "https://erp/projects/p1",
      }),
    ).toBe("Cliente: Ana\nTécnico: Carlos\nObra: https://erp/projects/p1");
  });
});

describe("quando avisar o técnico", () => {
  const a = schedule("2026-10-20T11:00:00.000Z");
  it("visita nova ou com data mudada avisa; a mesma data não", () => {
    expect(scheduleChanged(null, a)).toBe(true);
    expect(scheduleChanged(a, { ...a })).toBe(false);
    expect(scheduleChanged(a, schedule("2026-10-21T11:00:00.000Z"))).toBe(true);
    expect(scheduleChanged(a, { ...a, endMs: a.endMs + 3600_000 })).toBe(true);
    expect(scheduleChanged(a, null)).toBe(false);
  });
});

describe("próxima visita da obra", () => {
  const now = Date.parse("2026-10-15T12:00:00.000Z");

  it("a mais próxima que ainda não passou, fora das etapas concluídas", () => {
    const next = nextScheduledStage(
      [
        { name: "Medição", status: "done", schedule: schedule("2026-10-16T11:00:00.000Z") },
        { name: "Produção", status: "pending", schedule: null },
        { name: "Instalação", status: "pending", schedule: schedule("2026-10-25T11:00:00.000Z") },
        { name: "Configuração", status: "in_progress", schedule: schedule("2026-10-18T11:00:00.000Z") },
        { name: "Vistoria", status: "pending", schedule: schedule("2026-10-10T11:00:00.000Z") },
      ],
      now,
    );
    expect(next?.stageName).toBe("Configuração");
  });

  it("visita em andamento agora ainda conta", () => {
    const next = nextScheduledStage(
      [{ name: "Instalação", status: "in_progress", schedule: schedule("2026-10-15T11:00:00.000Z", 3) }],
      now,
    );
    expect(next?.stageName).toBe("Instalação");
  });

  it("nada marcado: null", () => {
    expect(nextScheduledStage([{ name: "Instalação", status: "pending" }], now)).toBeNull();
  });
});

describe("o que o cliente vê", () => {
  it("a data sem o id do evento", () => {
    const view = publicSchedule(schedule("2026-10-20T11:00:00.000Z"));
    expect(view).not.toHaveProperty("eventId");
    expect(view).toMatchObject({ isAllDay: false, startsAt: "2026-10-20T11:00:00.000Z" });
    expect(publicSchedule(null)).toBeNull();
    expect(publicSchedule(undefined)).toBeNull();
  });
});

describe("corpo do agendamento", () => {
  it("aceita horário ou dia inteiro, e recusa campo a mais", () => {
    expect(ScheduleStageSchema.safeParse({ isAllDay: false, startsAt: "a", endsAt: "b" }).success).toBe(true);
    expect(ScheduleStageSchema.safeParse({ isAllDay: true, startDate: "2026-10-20" }).success).toBe(true);
    expect(ScheduleStageSchema.safeParse({ isAllDay: true, startDate: "2026-10-20", projectId: "x" }).success).toBe(false);
    expect(ScheduleStageSchema.safeParse({ startsAt: "a" }).success).toBe(false);
  });
});
