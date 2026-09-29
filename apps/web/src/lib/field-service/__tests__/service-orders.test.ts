import { describe, expect, it } from "vitest";
import type { ServiceOrder } from "@/types/field-service";
import {
  filterOrders,
  isoToSchedule,
  orderTotal,
  scheduleToIso,
  sortQueue,
  warrantyState,
} from "../service-orders";

function order(over: Partial<ServiceOrder>): ServiceOrder {
  return {
    id: "o",
    tenantId: "t1",
    number: 1,
    code: "OS-0001",
    clientId: "c1",
    clientName: "Ana",
    clientPhone: null,
    address: null,
    type: "corrective",
    priority: "normal",
    status: "open",
    title: "Não gela",
    description: null,
    equipmentIds: [],
    equipmentLabels: [],
    projectId: null,
    technicianUids: [],
    technicianName: null,
    scheduledStart: null,
    scheduledEnd: null,
    checklist: [],
    items: [],
    totals: { products: 0, services: 0, total: 0 },
    photos: [],
    report: null,
    checkInAt: null,
    checkOutAt: null,
    signature: null,
    noSignatureReason: null,
    completedAt: null,
    canceledAt: null,
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: null,
    ...over,
  };
}

describe("filtros da lista", () => {
  const orders = [
    order({ id: "aberta", technicianUids: ["diego"] }),
    order({ id: "de-outro", status: "scheduled", technicianUids: ["lia"] }),
    order({ id: "concluida", status: "completed", technicianUids: ["diego"] }),
    order({ id: "cancelada", status: "canceled" }),
  ];

  it("em aberto deixa de fora concluída e cancelada", () => {
    expect(filterOrders(orders, "open", "diego").map((o) => o.id)).toEqual(["aberta", "de-outro"]);
  });

  it("minhas são as em aberto em que a pessoa é o técnico", () => {
    expect(filterOrders(orders, "mine", "diego").map((o) => o.id)).toEqual(["aberta"]);
    expect(filterOrders(orders, "mine", null)).toEqual([]);
  });

  it("concluídas não inclui canceladas", () => {
    expect(filterOrders(orders, "completed", "diego").map((o) => o.id)).toEqual(["concluida"]);
  });
});

describe("fila de trabalho", () => {
  it("agendadas primeiro, pela hora; depois urgência; empate pela mais antiga", () => {
    const sorted = sortQueue([
      order({ id: "normal-velha", createdAt: "2026-09-01T00:00:00Z" }),
      order({ id: "urgente", priority: "urgent", createdAt: "2026-09-05T00:00:00Z" }),
      order({ id: "tarde", scheduledStart: "2026-09-10T18:00:00Z" }),
      order({ id: "cedo", scheduledStart: "2026-09-10T11:00:00Z" }),
      order({ id: "normal-nova", createdAt: "2026-09-03T00:00:00Z" }),
    ]);
    expect(sorted.map((o) => o.id)).toEqual(["cedo", "tarde", "urgente", "normal-velha", "normal-nova"]);
  });
});

describe("agenda em horário de Brasília", () => {
  it("data, hora e duração viram início e fim em UTC", () => {
    expect(scheduleToIso({ date: "2026-09-29", time: "08:30", durationMin: 90 })).toEqual({
      start: "2026-09-29T11:30:00.000Z",
      end: "2026-09-29T13:00:00.000Z",
    });
  });

  it("ida e volta dão o mesmo formulário", () => {
    const fields = { date: "2026-12-31", time: "22:00", durationMin: 120 };
    const iso = scheduleToIso(fields)!;
    expect(isoToSchedule(iso.start, iso.end)).toEqual(fields);
  });

  it("recusa data ou hora incompleta", () => {
    expect(scheduleToIso({ date: "", time: "08:00", durationMin: 60 })).toBeNull();
    expect(scheduleToIso({ date: "2026-09-29", time: "8", durationMin: 60 })).toBeNull();
  });
});

it("total igual ao do backend, em centavos", () => {
  expect(
    orderTotal([
      { id: "a", kind: "product", refId: "p", name: "x", quantity: 3, unitPrice: 0.1, fromStock: true },
      { id: "b", kind: "service", refId: null, name: "y", quantity: 1.5, unitPrice: 120, fromStock: false },
    ]),
  ).toBe(180.3);
});

describe("garantia", () => {
  it.each([
    [null, "none"],
    ["2026-09-28", "expired"],
    ["2026-10-20", "expiring"],
    ["2027-03-01", "valid"],
  ] as const)("%s -> %s", (until, expected) => {
    expect(warrantyState(until, "2026-09-29")).toBe(expected);
  });
});
