// @vitest-environment jsdom
/**
 * "Pasta no Drive" no cadastro do cliente.
 *
 * Duas coisas aqui erram em silêncio:
 *
 * 1. **Abrir a aba DEPOIS do await** — o navegador só permite `window.open`
 *    durante o gesto do usuário. Abrir depois da resposta da API é bloqueado
 *    como popup, e o clique some sem erro nenhum.
 * 2. **Mostrar o botão sem o plano** — ele chamaria uma rota que devolve 402,
 *    virando uma promessa que a conta não pode cumprir.
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { getClientFolder, toastError, planLimits } = vi.hoisted(() => ({
  getClientFolder: vi.fn(),
  toastError: vi.fn(),
  planLimits: { hasDriveSync: true },
}));

vi.mock("@/services/drive-service", () => ({
  DriveService: { getClientFolder },
}));
vi.mock("@/lib/toast", () => ({ toast: { error: toastError, success: vi.fn() } }));
vi.mock("@/hooks/usePlanLimits", () => ({
  usePlanLimits: () => planLimits,
}));

import { OpenDriveFolderButton } from "../open-drive-folder-button";

const botao = () => screen.getByRole("button", { name: /Pasta no Drive/ });

beforeEach(() => {
  vi.clearAllMocks();
  planLimits.hasDriveSync = true;
  getClientFolder.mockResolvedValue({
    success: true,
    folderId: "pasta-9",
    url: "https://drive.google.com/drive/folders/pasta-9",
  });
});

describe("OpenDriveFolderButton", () => {
  it("não aparece sem o plano", () => {
    // Aparecer levaria a um 402 — uma promessa que a conta não pode cumprir.
    planLimits.hasDriveSync = false;
    render(<OpenDriveFolderButton clientId="c1" />);

    expect(screen.queryByRole("button", { name: /Pasta no Drive/ })).toBeNull();
  });

  it("abre a aba ANTES de chamar a API", async () => {
    // Se a aba fosse aberta depois do await, o bloqueador de popup a mataria —
    // e o usuário veria o clique não fazer nada.
    const aba = { location: { href: "" }, close: vi.fn() };
    const open = vi.fn(() => aba as unknown as Window);
    vi.stubGlobal("open", open);

    let resolveApi: (v: unknown) => void = () => {};
    getClientFolder.mockReturnValue(
      new Promise((resolve) => {
        resolveApi = resolve;
      }),
    );

    render(<OpenDriveFolderButton clientId="c1" />);
    await userEvent.click(botao());

    expect(open).toHaveBeenCalled();
    expect(aba.location.href).toBe("");

    resolveApi({ url: "https://drive.google.com/drive/folders/pasta-9" });
    await waitFor(() =>
      expect(aba.location.href).toBe(
        "https://drive.google.com/drive/folders/pasta-9",
      ),
    );
  });

  it("fecha a aba e avisa quando a API falha", async () => {
    // Deixar uma aba em branco aberta seria pior que não abrir nenhuma.
    const aba = { location: { href: "" }, close: vi.fn() };
    vi.stubGlobal("open", vi.fn(() => aba as unknown as Window));
    getClientFolder.mockRejectedValue(
      new Error("Escolha a pasta do Drive em Configurações → Google Drive."),
    );

    render(<OpenDriveFolderButton clientId="c1" />);
    await userEvent.click(botao());

    await waitFor(() => expect(aba.close).toHaveBeenCalled());
    expect(toastError).toHaveBeenCalledWith(
      "Escolha a pasta do Drive em Configurações → Google Drive.",
    );
  });

  it("navega na própria aba se o popup for bloqueado", async () => {
    vi.stubGlobal("open", vi.fn(() => null));
    const location = { href: "" };
    Object.defineProperty(window, "location", {
      value: location,
      writable: true,
    });

    render(<OpenDriveFolderButton clientId="c1" />);
    await userEvent.click(botao());

    await waitFor(() =>
      expect(location.href).toBe(
        "https://drive.google.com/drive/folders/pasta-9",
      ),
    );
  });
});
