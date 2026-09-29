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

import { BookingSettingsPanel } from "../booking-settings-panel";
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

describe("tela do link de agendamento", () => {
  it("liga, tira o sábado que não estava e salva; o link aparece depois", async () => {
    render(<BookingSettingsPanel />);
    await userEvent.click(await screen.findByRole("switch", { name: "Ligar o link de agendamento" }));
    await userEvent.click(screen.getByRole("button", { name: "Seg" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(m.save).toHaveBeenCalledWith(expect.objectContaining({ enabled: true, days: [2, 3, 4, 5] })),
    );
    expect(await screen.findByText(/\/share\/visita\/abcDEF123456$/)).toBeInTheDocument();
  });

  it("acrescenta e remove tipo de visita", async () => {
    render(<BookingSettingsPanel />);
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

  it("a duração tem rótulo próprio, como os tipos de visita", async () => {
    render(<BookingSettingsPanel />);
    await screen.findByText("Tipos de visita");
    expect(screen.getAllByText("Tempo de duração").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Tempo de duração do tipo de visita 1")).toBeInTheDocument();
  });

  it("acrescenta uma exceção por horário e salva a faixa", async () => {
    m.get.mockResolvedValue({ ...SETTINGS, exceptions: [] });
    render(<BookingSettingsPanel />);
    expect(await screen.findByText(/Nenhuma exceção/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Adicionar exceção" }));
    await userEvent.click(screen.getByRole("switch", { name: "Dia inteiro" }));
    await userEvent.type(screen.getByLabelText("Motivo (só você vê)"), "Treinamento");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(m.save).toHaveBeenCalledWith(
        expect.objectContaining({
          exceptions: [expect.objectContaining({ allDay: false, startMin: 540, endMin: 660, note: "Treinamento" })],
        }),
      ),
    );
  });

  it("remove a exceção gravada", async () => {
    m.get.mockResolvedValue({
      ...SETTINGS,
      exceptions: [{ id: "exc_20301012_dia", date: "2030-10-12", allDay: true, startMin: null, endMin: null, note: null }],
    });
    render(<BookingSettingsPanel />);
    await userEvent.click(await screen.findByRole("button", { name: /Remover a exceção de .*dia inteiro/ }));
    expect(screen.getByText(/Nenhuma exceção/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(m.save).toHaveBeenCalledWith(expect.objectContaining({ exceptions: [] })));
  });

  it("backend sem exceções: o editor não aparece", async () => {
    render(<BookingSettingsPanel />);
    await screen.findByText("Tipos de visita");
    expect(screen.queryByText("Exceções")).toBeNull();
    expect(screen.queryByRole("button", { name: "Adicionar exceção" })).toBeNull();
  });

  it("na demonstração mostra o padrão sem chamar a API e sem salvar", () => {
    render(
      <BookingSettingsPanel
        readOnly
        demoDefaults={demoBookingSettings({ id: "medicao", label: "Medição", durationMin: 60 })}
      />,
    );
    expect(m.get).not.toHaveBeenCalled();
    expect(screen.getByText(/Na conta de demonstração o link fica desligado/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Medição")).toBeDisabled();
    expect(screen.getByRole("switch")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
    // A demonstração mostra o editor de exceções vazio, sem o botão de acrescentar.
    expect(screen.getByText(/Nenhuma exceção/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar exceção" })).toBeNull();
  });
});
