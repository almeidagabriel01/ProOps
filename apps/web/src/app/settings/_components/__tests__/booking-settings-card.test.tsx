// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  get: vi.fn(),
  save: vi.fn(),
}));

vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/services/booking-service", () => ({
  BookingService: {
    getSettings: (...a: unknown[]) => m.get(...a),
    saveSettings: (...a: unknown[]) => m.save(...a),
  },
}));

import { BookingSettingsCard } from "../booking-settings-card";
import { demoBookingSettings } from "@/lib/booking/booking-format";

const SETTINGS = {
  enabled: false,
  publicToken: null as string | null,
  days: [1, 2, 3, 4, 5],
  startMin: 540,
  endMin: 1080,
  leadHours: 24,
  horizonDays: 21,
  visitTypes: [{ id: "visita_tecnica", label: "Visita técnica", durationMin: 60 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  m.get.mockResolvedValue(SETTINGS);
  m.save.mockImplementation(async (input: typeof SETTINGS) => ({ ...input, publicToken: "abcDEF123456" }));
});

describe("link de agendamento nas configurações", () => {
  it("liga, tira o sábado que não estava e salva; o link aparece depois", async () => {
    render(<BookingSettingsCard />);
    await userEvent.click(await screen.findByRole("switch", { name: "Ligar o link de agendamento" }));
    await userEvent.click(screen.getByRole("button", { name: "Seg" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(m.save).toHaveBeenCalledWith(expect.objectContaining({ enabled: true, days: [2, 3, 4, 5] })),
    );
    expect(await screen.findByText(/\/share\/visita\/abcDEF123456$/)).toBeInTheDocument();
  });

  it("acrescenta e remove tipo de visita", async () => {
    render(<BookingSettingsCard />);
    await userEvent.click(await screen.findByRole("button", { name: "Adicionar tipo de visita" }));
    await userEvent.type(screen.getByLabelText("Nome do tipo de visita 2"), "Orçamento");
    await userEvent.click(screen.getByRole("button", { name: "Remover Visita técnica" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(m.save).toHaveBeenCalledWith(
        expect.objectContaining({ visitTypes: [{ id: "", label: "Orçamento", durationMin: 60 }] }),
      ),
    );
  });

  it("na demonstração mostra o padrão sem chamar a API e sem salvar", () => {
    render(
      <BookingSettingsCard
        readOnly
        demoDefaults={demoBookingSettings({ id: "medicao", label: "Medição", durationMin: 60 })}
      />,
    );
    expect(m.get).not.toHaveBeenCalled();
    expect(screen.getByText(/Na conta de demonstração o link fica desligado/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Medição")).toBeDisabled();
    expect(screen.getByRole("switch")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
  });
});
