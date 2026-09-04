// @vitest-environment jsdom
/**
 * Conexão com o Google Drive.
 *
 * O estado que engana aqui é "conectado sem pasta": a conta aparece ligada, a
 * tela parece pronta, e nenhuma proposta é entregue porque não há destino. Ele
 * é o mais provável de acontecer — conectar e escolher a pasta são dois passos,
 * e o segundo é fácil de adiar.
 *
 * O outro risco é o retorno do OAuth: ele chega como REDIRECT com query string,
 * não como resposta de API. Sem tratar, o usuário volta para uma tela idêntica
 * e não sabe se autorizou ou recusou.
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const {
  getStatus,
  disconnect,
  setRootFolder,
  createRootFolder,
  getAuthUrl,
  pickFolder,
  toastSuccess,
  toastError,
} = vi.hoisted(() => ({
  getStatus: vi.fn(),
  disconnect: vi.fn(),
  setRootFolder: vi.fn(),
  createRootFolder: vi.fn(),
  getAuthUrl: vi.fn(),
  pickFolder: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

/** O Picker é opcional: sem as variáveis públicas ele nem aparece. */
let pickerConfigurado = true;

let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));
vi.mock("@/services/drive-service", () => ({
  DriveService: {
    getStatus,
    disconnect,
    setRootFolder,
    createRootFolder,
    getAuthUrl,
  },
}));
vi.mock("@/hooks/use-google-picker", () => ({
  useGooglePicker: () => ({
    pickFolder,
    isOpening: false,
    isConfigured: pickerConfigurado,
  }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

import { DriveSettingsCard } from "../drive-settings-card";

const DESCONECTADO = {
  connected: false,
  connectedEmail: null,
  rootFolderId: null,
  rootFolderName: null,
};

const CONECTADO_SEM_PASTA = {
  connected: true,
  connectedEmail: "dono@empresa.com.br",
  rootFolderId: null,
  rootFolderName: null,
};

const PRONTO = {
  connected: true,
  connectedEmail: "dono@empresa.com.br",
  rootFolderId: "raiz-1",
  rootFolderName: "Clientes",
};

beforeEach(() => {
  vi.clearAllMocks();
  searchParams = new URLSearchParams();
  pickerConfigurado = true;
  disconnect.mockResolvedValue({ success: true });
  setRootFolder.mockResolvedValue({ success: true });
  createRootFolder.mockResolvedValue({
    success: true,
    folderId: "raiz-nova",
    folderName: "ProOps - Propostas",
  });
});

describe("DriveSettingsCard", () => {
  it("só oferece conectar quando não há conta", async () => {
    getStatus.mockResolvedValue(DESCONECTADO);
    render(<DriveSettingsCard />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Conectar Google Drive/ }),
      ).toBeInTheDocument(),
    );
    // Escolher pasta sem conta conectada não faria sentido nenhum.
    expect(screen.queryByText("Pasta das propostas")).toBeNull();
  });

  it("AVISA quando está conectado mas sem pasta", async () => {
    // O teste mais importante: sem pasta nada é entregue, e a tela não pode
    // parecer pronta.
    getStatus.mockResolvedValue(CONECTADO_SEM_PASTA);
    render(<DriveSettingsCard />);

    await waitFor(() =>
      expect(
        screen.getByText(/nenhuma proposta é enviada para o Drive/i),
      ).toBeInTheDocument(),
    );
  });

  it("mostra a conta e a pasta quando está pronto", async () => {
    getStatus.mockResolvedValue(PRONTO);
    render(<DriveSettingsCard />);

    await waitFor(() =>
      expect(screen.getByText("dono@empresa.com.br")).toBeInTheDocument(),
    );
    expect(screen.getByText("Clientes")).toBeInTheDocument();
    expect(screen.queryByText(/nenhuma proposta é enviada/i)).toBeNull();
  });

  it("CRIA a pasta como caminho principal", async () => {
    // O Picker exige API key, Picker API e cookies de terceiro, e falha de
    // formas que dependem do navegador do cliente — não pode ser pré-requisito
    // para usar o módulo.
    getStatus.mockResolvedValue(CONECTADO_SEM_PASTA);
    render(<DriveSettingsCard />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Criar pasta no meu Drive/ })).toBeInTheDocument(),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Criar pasta no meu Drive/ }),
    );

    await waitFor(() => expect(createRootFolder).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByText("ProOps - Propostas")).toBeInTheDocument(),
    );
  });

  it("explica que a pasta pode ser MOVIDA depois", async () => {
    // É o que torna a criação equivalente a escolher: no escopo drive.file o
    // acesso segue o arquivo, não o caminho.
    getStatus.mockResolvedValue(CONECTADO_SEM_PASTA);
    render(<DriveSettingsCard />);

    await waitFor(() =>
      expect(screen.getByText(/movê-la, renomeá-la e compartilhá-la/)).toBeInTheDocument(),
    );
  });

  it("ainda oferece criar quando o Picker não está configurado", async () => {
    // Sem a API key o módulo continua utilizável — só a opção de apontar uma
    // pasta existente some.
    pickerConfigurado = false;
    getStatus.mockResolvedValue(CONECTADO_SEM_PASTA);
    render(<DriveSettingsCard />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Criar pasta no meu Drive/ })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: /já existe/ })).toBeNull();
  });

  it("grava a pasta escolhida no Picker", async () => {
    getStatus.mockResolvedValue(CONECTADO_SEM_PASTA);
    pickFolder.mockResolvedValue({ id: "pasta-9", name: "Obras 2026" });
    render(<DriveSettingsCard />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /já existe/ })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole("button", { name: /já existe/ }));

    await waitFor(() =>
      expect(setRootFolder).toHaveBeenCalledWith("pasta-9", "Obras 2026"),
    );
    // E a tela reflete na hora, sem recarregar.
    await waitFor(() => expect(screen.getByText("Obras 2026")).toBeInTheDocument());
  });

  it("cancelar o Picker não grava nada", async () => {
    getStatus.mockResolvedValue(CONECTADO_SEM_PASTA);
    pickFolder.mockResolvedValue(null);
    render(<DriveSettingsCard />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /já existe/ })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole("button", { name: /já existe/ }));

    await waitFor(() => expect(pickFolder).toHaveBeenCalled());
    expect(setRootFolder).not.toHaveBeenCalled();
  });

  it("diz o que NÃO se perde ao desconectar", async () => {
    // Sem isto, "desconectar" parece que apaga os arquivos do Drive.
    getStatus.mockResolvedValue(PRONTO);
    render(<DriveSettingsCard />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Desconectar" })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole("button", { name: "Desconectar" }));

    const dialogo = screen.getByRole("alertdialog");
    expect(dialogo).toHaveTextContent(/continuam no seu Drive/);
    expect(disconnect).not.toHaveBeenCalled();
  });

  it("traduz a recusa de consentimento que volta na URL", async () => {
    // O retorno do OAuth é um redirect, não uma resposta de API — sem tratar,
    // o usuário volta para uma tela idêntica sem saber o que aconteceu.
    searchParams = new URLSearchParams("googleDrive=error&reason=access_denied");
    getStatus.mockResolvedValue(DESCONECTADO);
    render(<DriveSettingsCard />);

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Você recusou o acesso ao Google Drive.",
      ),
    );
  });

  it("mostra o CÓDIGO quando o motivo é desconhecido", async () => {
    // A falha acontece no callback, do lado do servidor: não há nada em
    // network nem no console. Engolir o código deixaria o usuário com um
    // toast genérico e nenhuma forma de dizer o que houve.
    searchParams = new URLSearchParams("googleDrive=error&reason=algo_novo");
    getStatus.mockResolvedValue(DESCONECTADO);
    render(<DriveSettingsCard />);

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining("algo_novo"),
      ),
    );
  });

  it("confirma a conexão bem-sucedida", async () => {
    searchParams = new URLSearchParams("googleDrive=connected");
    getStatus.mockResolvedValue(PRONTO);
    render(<DriveSettingsCard />);

    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Google Drive conectado."),
    );
  });
});
