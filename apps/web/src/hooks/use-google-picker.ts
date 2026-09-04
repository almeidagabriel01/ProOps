"use client";

import * as React from "react";

/**
 * Escolher uma pasta do Google Drive pelo Google Picker.
 *
 * **Por que o Picker existe neste projeto:** a integração usa o escopo
 * `drive.file`, que o Google classifica como *não sensível* — o app só enxerga
 * o que ele mesmo criou. Isso significa que não conseguimos LISTAR as pastas do
 * usuário para ele escolher numa tela nossa. O Picker é o mecanismo oficial que
 * "abre" um item para o app sem exigir um escopo restrito (`drive` ou
 * `drive.readonly`), que dispararia o security assessment CASA, refeito a cada
 * 12 meses enquanto o app existir.
 *
 * **Por que o token vem do navegador, e não do nosso backend:** seria mais
 * simples o servidor cunhar um access token a partir do refresh token que ele
 * guarda e devolvê-lo aqui. Mas isso colocaria uma credencial emitida por nós
 * dentro do browser, ao alcance de qualquer XSS. O token pedido aqui pelo
 * Google Identity Services é curto, fica só nesta página e nunca é persistido —
 * e o refresh token continua exclusivamente no servidor, cifrado em KMS.
 *
 * O `client_id` e a API key são públicos por natureza (vão no HTML). O que
 * protege a API key é a restrição por referenciador HTTP configurada no Google
 * Cloud; o que protege o client_id são as origens JavaScript autorizadas.
 */

const GIS_SRC = "https://accounts.google.com/gsi/client";
const GAPI_SRC = "https://apis.google.com/js/api.js";
const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export interface PickedFolder {
  id: string;
  name: string;
}

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
}

interface PickerDocument {
  id: string;
  name: string;
}

/** Superfície mínima das libs do Google que este hook consome. */
interface GoogleGlobal {
  accounts?: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (response: GoogleTokenResponse) => void;
      }) => { requestAccessToken: () => void };
    };
  };
  picker?: {
    DocsView: new (viewId: string) => {
      setIncludeFolders: (v: boolean) => unknown;
      setSelectFolderEnabled: (v: boolean) => unknown;
      setMimeTypes: (v: string) => unknown;
    };
    ViewId: { FOLDERS: string };
    PickerBuilder: new () => {
      addView: (view: unknown) => unknown;
      setOAuthToken: (token: string) => unknown;
      setDeveloperKey: (key: string) => unknown;
      setCallback: (cb: (data: Record<string, unknown>) => void) => unknown;
      setTitle: (title: string) => unknown;
      build: () => { setVisible: (v: boolean) => void };
    };
    Action: { PICKED: string };
    Response: { ACTION: string; DOCUMENTS: string };
  };
}

declare global {
  interface Window {
    google?: GoogleGlobal;
    gapi?: { load: (name: string, cb: () => void) => void };
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Idempotente: abrir o Picker duas vezes não pode injetar a lib de novo.
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    );
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error(`falha ao carregar ${src}`)));
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`falha ao carregar ${src}`));
    document.body.appendChild(script);
  });
}

function requestAccessToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) {
      reject(new Error("Google Identity Services não carregou."));
      return;
    }
    const tokenClient = oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_FILE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error || "Autorização não concedida."));
          return;
        }
        resolve(response.access_token);
      },
    });
    tokenClient.requestAccessToken();
  });
}

function loadPicker(): Promise<void> {
  return new Promise((resolve) => {
    if (window.google?.picker) {
      resolve();
      return;
    }
    window.gapi?.load("picker", () => resolve());
  });
}

export interface UseGooglePickerResult {
  /** Abre o Picker. Resolve com a pasta escolhida, ou `null` se cancelar. */
  pickFolder: () => Promise<PickedFolder | null>;
  isOpening: boolean;
  /** Falso quando faltam as variáveis públicas — a UI esconde o botão. */
  isConfigured: boolean;
}

export function useGooglePicker(): UseGooglePickerResult {
  const [isOpening, setIsOpening] = React.useState(false);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID || "";
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY || "";
  const isConfigured = Boolean(clientId && apiKey);

  const pickFolder = React.useCallback(async (): Promise<PickedFolder | null> => {
    if (!isConfigured) {
      throw new Error("O seletor de pastas do Google não está configurado.");
    }
    setIsOpening(true);
    try {
      await Promise.all([loadScript(GIS_SRC), loadScript(GAPI_SRC)]);
      const accessToken = await requestAccessToken(clientId);
      await loadPicker();

      const picker = window.google?.picker;
      if (!picker) {
        throw new Error("O seletor de pastas do Google não carregou.");
      }

      return await new Promise<PickedFolder | null>((resolve) => {
        const view = new picker.DocsView(picker.ViewId.FOLDERS);
        view.setIncludeFolders(true);
        view.setSelectFolderEnabled(true);
        // Só pastas: o destino das propostas nunca é um arquivo.
        view.setMimeTypes("application/vnd.google-apps.folder");

        const builder = new picker.PickerBuilder();
        builder.addView(view);
        builder.setOAuthToken(accessToken);
        builder.setDeveloperKey(apiKey);
        builder.setTitle("Escolha a pasta onde as propostas devem ficar");
        builder.setCallback((data) => {
          const action = data[picker.Response.ACTION];
          if (action !== picker.Action.PICKED) {
            // Fechar sem escolher não é erro — resolve com null e a tela
            // simplesmente não muda.
            if (action === "cancel") resolve(null);
            return;
          }
          const docs = data[picker.Response.DOCUMENTS] as
            | PickerDocument[]
            | undefined;
          const first = docs?.[0];
          resolve(first ? { id: first.id, name: first.name } : null);
        });
        builder.build().setVisible(true);
      });
    } finally {
      setIsOpening(false);
    }
  }, [clientId, apiKey, isConfigured]);

  return { pickFolder, isOpening, isConfigured };
}
