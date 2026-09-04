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

  it("abre a aba nova com a URL já resolvida", async () => {
    // Pré-abrir uma aba em branco e navegá-la depois produzia, em navegador
    // com bloqueio agressivo, o pior dos dois mundos: uma aba `about:blank`
    // órfã E a aba do ERP indo embora para o Drive.
    const open = vi.fn(() => ({}) as unknown as Window);
    vi.stubGlobal("open", open);

    render(<OpenDriveFolderButton clientId="c1" />);
    await userEvent.click(botao());

    await waitFor(() =>
      expect(open).toHaveBeenCalledWith(
        "https://drive.google.com/drive/folders/pasta-9",
        "_blank",
        "noopener,noreferrer",
      ),
    );
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("não abre aba nenhuma quando a API falha", async () => {
    // Aba em branco sobrando é pior que não abrir nada.
    const open = vi.fn();
    vi.stubGlobal("open", open);
    getClientFolder.mockRejectedValue(new Error("Escolha a pasta do Drive."));

    render(<OpenDriveFolderButton clientId="c1" />);
    await userEvent.click(botao());

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(open).not.toHaveBeenCalled();
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
