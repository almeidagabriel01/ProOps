import { callApi } from "@/lib/api-client";

/**
 * Integração com o Google Drive — entrega da proposta na pasta do cliente.
 *
 * Só de ida: nada é lido do Drive. Essa decisão é o que mantém a integração no
 * escopo `drive.file`, que o Google classifica como **não sensível**; ler
 * exigiria um escopo restrito, com auditoria CASA refeita a cada 12 meses.
 */

export interface DriveStatus {
  connected: boolean;
  /** Conexão existe mas o Google recusa renovar — só reconectando resolve. */
  needsReconnect?: boolean;
  connectedEmail: string | null;
  rootFolderId: string | null;
  rootFolderName: string | null;
}

export interface DriveClientFolder {
  folderId: string;
  url: string;
}

export const DriveService = {
  getStatus: () =>
    callApi<DriveStatus & { success: boolean }>("/v1/drive/google/status", "GET"),

  getAuthUrl: () =>
    callApi<{ success: boolean; authUrl: string }>(
      "/v1/drive/google/auth-url",
      "GET",
    ),

  disconnect: () =>
    callApi<{ success: boolean; message: string }>(
      "/v1/drive/google/status",
      "DELETE",
    ),

  /**
   * Cria a pasta raiz no Drive do usuário — o caminho padrão.
   *
   * Não é um substituto pior do que escolher: no escopo `drive.file` o acesso
   * segue o arquivo, não o caminho, então o usuário pode mover essa pasta para
   * dentro da estrutura que já tem e o resultado é o mesmo.
   */
  createRootFolder: () =>
    callApi<{ success: boolean; folderId: string; folderName: string }>(
      "/v1/drive/google/root-folder",
      "POST",
    ),

  /**
   * Grava a pasta raiz escolhida no Google Picker.
   *
   * O id vem do Picker e não de uma busca nossa: com `drive.file` o app não
   * enxerga o que não criou, e é o Picker que "abre" a pasta para ele.
   */
  setRootFolder: (folderId: string, folderName: string) =>
    callApi<{ success: boolean }>("/v1/drive/google/root-folder", "PUT", {
      folderId,
      folderName,
    }),

  /** Resolve (criando se preciso) a pasta do cliente e devolve o link. */
  getClientFolder: (clientId: string) =>
    callApi<DriveClientFolder & { success: boolean }>(
      `/v1/drive/clients/${clientId}/folder`,
      "GET",
    ),
};
