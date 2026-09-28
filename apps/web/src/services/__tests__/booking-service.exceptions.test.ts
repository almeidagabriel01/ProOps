import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/api-client", () => ({
  callApi: vi.fn(),
  callPublicApi: vi.fn(),
}));

import { callApi } from "@/lib/api-client";
import { BookingService, type BookingSettings } from "../booking-service";

const mockedCallApi = callApi as unknown as Mock;

const BASE: Omit<BookingSettings, "publicToken"> = {
  enabled: true,
  days: [1, 2, 3, 4, 5],
  startMin: 540,
  endMin: 1080,
  leadHours: 24,
  horizonDays: 21,
  visitTypes: [{ id: "visita_tecnica", label: "Visita técnica", durationMin: 60 }],
};

function sentBody(): Record<string, unknown> {
  return mockedCallApi.mock.calls[0][2] as Record<string, unknown>;
}

describe("BookingService.saveSettings e as exceções", () => {
  beforeEach(() => {
    mockedCallApi.mockReset();
    mockedCallApi.mockResolvedValue({ settings: { ...BASE, publicToken: null } });
  });

  it("sem o campo (backend antigo), não manda exceções: o schema estrito recusaria", async () => {
    await BookingService.saveSettings(BASE);
    expect(sentBody()).not.toHaveProperty("exceptions");
  });

  it("lista vazia é mandada, para apagar as exceções gravadas", async () => {
    await BookingService.saveSettings({ ...BASE, exceptions: [] });
    expect(sentBody().exceptions).toEqual([]);
  });

  it("dia inteiro vai sem horário, e motivo em branco vira null", async () => {
    await BookingService.saveSettings({
      ...BASE,
      exceptions: [
        { id: "", date: "2026-10-12", allDay: true, startMin: 600, endMin: 660, note: "  " },
        { id: "exc_20261013_600", date: "2026-10-13", allDay: false, startMin: 600, endMin: 660, note: " Dentista " },
      ],
    });
    expect(sentBody().exceptions).toEqual([
      { id: undefined, date: "2026-10-12", allDay: true, startMin: null, endMin: null, note: null },
      { id: "exc_20261013_600", date: "2026-10-13", allDay: false, startMin: 600, endMin: 660, note: "Dentista" },
    ]);
  });
});
