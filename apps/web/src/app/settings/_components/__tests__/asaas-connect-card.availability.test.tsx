// @vitest-environment jsdom
/**
 * O cliente preencheu CNPJ, faturamento e endereco inteiros para so entao
 * receber 500, porque a chave mestre do Asaas nunca foi configurada em
 * producao. O backend passou a dizer se CONSEGUE criar subconta
 * (`platformAvailable`), e a tela precisa respeitar isso ANTES do formulario.
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { AsaasConnectCard } from "../asaas-connect-card";
import type { AsaasConnectionStatus } from "@/services/payment-service";

const mockGetStatus = vi.fn();

vi.mock("@/services/payment-service", () => ({
  AsaasService: {
    getStatus: (...args: unknown[]) => mockGetStatus(...args),
    connect: vi.fn(),
    disconnect: vi.fn(),
    retryWebhook: vi.fn(),
    updatePayout: vi.fn(),
  },
}));

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockUsePermissions = vi.fn(() => ({ isDemo: false }));
vi.mock("@/providers/permissions-provider", () => ({
  usePermissions: () => mockUsePermissions(),
}));

async function renderWithStatus(status: AsaasConnectionStatus) {
  mockGetStatus.mockResolvedValue(status);
  render(<AsaasConnectCard />);
  await waitFor(() => expect(mockGetStatus).toHaveBeenCalled());
}

const CONNECT_BUTTON = /habilitar pagamentos/i;
const UNAVAILABLE_TEXT = /temporariamente indispon[ií]ve/i;

describe("AsaasConnectCard: disponibilidade da plataforma", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePermissions.mockReturnValue({ isDemo: false });
  });

  it("esconde o botao de habilitar quando o servidor nao tem Asaas configurado", async () => {
    await renderWithStatus({ connected: false, platformAvailable: false });

    await waitFor(() => expect(screen.getByText(UNAVAILABLE_TEXT)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: CONNECT_BUTTON })).toBeNull();
  });

  it("mostra o botao quando o servidor consegue criar subconta", async () => {
    await renderWithStatus({ connected: false, platformAvailable: true });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: CONNECT_BUTTON })).toBeInTheDocument(),
    );
    expect(screen.queryByText(UNAVAILABLE_TEXT)).toBeNull();
  });

  // Backend antigo nao manda o campo. Fechar por omissao esconderia um modulo
  // que funciona durante a janela entre o deploy do front e o do backend.
  it("mostra o botao quando o backend nao informa o campo", async () => {
    await renderWithStatus({ connected: false });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: CONNECT_BUTTON })).toBeInTheDocument(),
    );
    expect(screen.queryByText(UNAVAILABLE_TEXT)).toBeNull();
  });

  // Tenant ja conectado nao pode perder a tela por causa de uma flag de
  // servidor: ele ja tem subconta, e o que ele ve ali e o proprio estado.
  it("nao afeta um tenant ja conectado", async () => {
    await renderWithStatus({
      connected: true,
      platformAvailable: false,
      environment: "production",
      connectedAt: new Date().toISOString(),
    });

    await waitFor(() => expect(screen.getByText(/ativo/i)).toBeInTheDocument());
    expect(screen.queryByText(UNAVAILABLE_TEXT)).toBeNull();
  });
});
