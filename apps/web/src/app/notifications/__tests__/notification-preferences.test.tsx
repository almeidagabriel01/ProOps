// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  permissions: {
    permissions: { pages: { proposals: { canView: true } } } as unknown,
    isMaster: false,
    isDemo: false,
    isLoading: false,
  },
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/providers/permissions-provider", () => ({ usePermissions: () => m.permissions }));
vi.mock("@/lib/toast", () => ({ toast: { error: m.toastError, success: vi.fn() } }));
vi.mock("@/services/notification-service", () => ({
  NotificationService: {
    getPreferences: (...a: unknown[]) => m.getPreferences(...a),
    updatePreferences: (...a: unknown[]) => m.updatePreferences(...a),
  },
}));

import { NotificationPreferencesPanel } from "../_components/notification-preferences";

beforeEach(() => {
  vi.clearAllMocks();
  m.permissions = {
    permissions: { pages: { proposals: { canView: true } } },
    isMaster: false,
    isDemo: false,
    isLoading: false,
  };
  m.getPreferences.mockResolvedValue({});
});

describe("preferências de notificação", () => {
  it("membro só de propostas não vê os tipos do financeiro nem os avisos da conta", async () => {
    render(<NotificationPreferencesPanel />);
    expect(await screen.findByText("Cliente aceitou a proposta")).toBeInTheDocument();
    expect(screen.queryByText("Pagamento online recebido")).toBeNull();
    expect(screen.queryByText("Avisos da conta")).toBeNull();
  });

  it("mostra os padrões: e-mail ligado no aceite, desligado na visualização", async () => {
    render(<NotificationPreferencesPanel />);
    const aceite = await screen.findByRole("switch", { name: "Cliente aceitou a proposta por e-mail" });
    const vista = screen.getByRole("switch", { name: "Proposta visualizada por e-mail" });
    expect(aceite).toHaveAttribute("aria-checked", "true");
    expect(vista).toHaveAttribute("aria-checked", "false");
  });

  it("lembrete diário não tem e-mail", async () => {
    render(<NotificationPreferencesPanel />);
    await screen.findByText("Proposta perto da validade");
    expect(screen.queryByRole("switch", { name: "Proposta perto da validade por e-mail" })).toBeNull();
  });

  it("ligar grava só aquele tipo e aquele canal", async () => {
    m.updatePreferences.mockResolvedValue({ proposal_viewed: { email: true } });
    render(<NotificationPreferencesPanel />);
    await userEvent.click(await screen.findByRole("switch", { name: "Proposta visualizada por e-mail" }));
    expect(m.updatePreferences).toHaveBeenCalledWith({ proposal_viewed: { email: true } });
    await waitFor(() =>
      expect(screen.getByRole("switch", { name: "Proposta visualizada por e-mail" })).toHaveAttribute(
        "aria-checked",
        "true",
      ),
    );
  });

  it("falha ao salvar volta o interruptor e avisa", async () => {
    m.updatePreferences.mockRejectedValue(new Error("fora"));
    render(<NotificationPreferencesPanel />);
    const vista = await screen.findByRole("switch", { name: "Proposta visualizada por e-mail" });
    await userEvent.click(vista);
    await waitFor(() => expect(m.toastError).toHaveBeenCalled());
    expect(screen.getByRole("switch", { name: "Proposta visualizada por e-mail" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("conta de demonstração vê tudo, desligado para edição, sem chamar a API", async () => {
    m.permissions = { permissions: null, isMaster: false, isDemo: true, isLoading: false };
    render(<NotificationPreferencesPanel />);
    const pago = await screen.findByRole("switch", { name: "Pagamento online recebido por e-mail" });
    expect(pago).toBeDisabled();
    expect(m.getPreferences).not.toHaveBeenCalled();
  });
});
