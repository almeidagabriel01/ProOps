/**
 * Integracao com o Google Drive — conexao, pasta raiz e entrega da proposta.
 *
 * Conectar a conta e apontar a pasta sao atos do DONO da empresa: e a conta
 * Google dele e o armazenamento dele. O mesmo padrao de Notas Fiscais e
 * Pagamento Online, que ja sao master-only em `/settings`.
 *
 * Ja ABRIR a pasta de um cliente segue a permissao de contatos — sao os
 * vendedores que vao usar isso no dia a dia, e foi exatamente esse o caso de
 * uso que originou o pedido.
 */

import { Request, Response } from "express";
import { z } from "zod";
import { logger } from "../../lib/logger";
import { isTenantAdminRole } from "../../lib/auth-context";
import { hasPagePermission } from "../../lib/auth-helpers";
import {
  consumeOAuthState,
  createDriveOAuthClient,
  createOAuthState,
  disconnectDrive,
  fetchConnectedEmail,
  getDriveIntegration,
  GOOGLE_DRIVE_SCOPES,
  isInvalidGrantError,
  markNeedsReconnect,
  resolveDriveAppOrigin,
  saveDriveIntegration,
  saveRootFolder,
} from "../services/drive/drive-oauth.service";
import {
  createRootFolder,
  ensureClientFolder,
  tagRootFolder,
} from "../services/drive/drive.service";

// RFC 4122 UUID — o `state` sai de crypto.randomUUID() (v4).
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * `code` e opaco (o Google nao garante formato) e opcional para nao quebrar o
 * fluxo de consentimento recusado, que volta com `?error=access_denied` e sem
 * `code`. O refine exige pelo menos um dos dois.
 */
const CallbackQuerySchema = z
  .object({
    state: z.string().regex(UUID_RE),
    code: z.string().min(1).optional(),
    error: z
      .string()
      .regex(/^[a-z0-9_-]{1,64}$/i)
      .optional(),
  })
  .refine((data) => Boolean(data.code) || Boolean(data.error), {
    message: "code_or_error_required",
  });

/** O id de uma pasta do Drive: opaco, mas limitado a um alfabeto conhecido. */
const DRIVE_ID_RE = /^[A-Za-z0-9_-]{10,200}$/;

function resolveTenantId(req: Request): string {
  if (req.user?.tenantId) {
    return req.user.tenantId;
  }
  if (req.user?.isSuperAdmin) {
    return String(req.headers["x-tenant-id"] || "").trim();
  }
  return "";
}

function canManageIntegration(req: Request): boolean {
  return Boolean(
    req.user?.isSuperAdmin || isTenantAdminRole(req.user?.role || ""),
  );
}

function buildRedirectUrl(status: "connected" | "error", reason?: string): string {
  // Origem configurada, NUNCA o host da request — que um atacante pode forjar
  // para influenciar o destino do redirect. E a mesma origem do `redirect_uri`:
  // usar a de `APP_URL` jogava quem testa local contra o backend implantado
  // para fora da aplicacao onde comecou.
  const url = new URL("/settings/drive", resolveDriveAppOrigin());
  url.searchParams.set("googleDrive", status);
  if (reason) {
    url.searchParams.set("reason", reason);
  }
  return url.toString();
}

// GET /v1/drive/google/auth-url
export async function getDriveAuthUrl(req: Request, res: Response) {
  try {
    const tenantId = resolveTenantId(req);
    if (!req.user?.uid || !tenantId) {
      return res.status(403).json({ message: "Tenant não identificado." });
    }
    if (!canManageIntegration(req)) {
      return res.status(403).json({
        message: "Somente administradores podem conectar o Google Drive.",
      });
    }

    const oauthClient = await createDriveOAuthClient();
    const state = await createOAuthState(req.user.uid, tenantId);

    const authUrl = oauthClient.generateAuthUrl({
      // `offline` + `consent` para garantir o refresh token: sem ele a conexao
      // morre no primeiro vencimento do access token, horas depois.
      access_type: "offline",
      prompt: "consent",
      scope: GOOGLE_DRIVE_SCOPES,
      include_granted_scopes: true,
      state,
    });

    return res.json({ success: true, authUrl });
  } catch (error) {
    const message =
      error instanceof Error && error.message === "GOOGLE_DRIVE_NAO_CONFIGURADO"
        ? "Configure GOOGLE_CALENDAR_CLIENT_ID e GOOGLE_CALENDAR_CLIENT_SECRET."
        : "Não foi possível iniciar a conexão com o Google Drive.";
    logger.error("Falha ao gerar URL de autorização do Drive", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ message });
  }
}

// GET /v1/drive/google/callback  (público — quem chama é o Google)
export async function handleDriveCallback(req: Request, res: Response) {
  const parsed = CallbackQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.redirect(buildRedirectUrl("error", "invalid_request"));
  }

  const { state, code, error: oauthError } = parsed.data;
  if (oauthError) {
    // Consentimento recusado é uma escolha do usuário, não uma falha nossa —
    // devolver o motivo real evita "erro desconhecido" sobre um clique em Não.
    return res.redirect(buildRedirectUrl("error", oauthError));
  }
  if (!code) {
    return res.redirect(buildRedirectUrl("error", "invalid_request"));
  }

  try {
    const consumed = await consumeOAuthState(state);
    if ("error" in consumed) {
      // O `state` e de uso unico, entao a causa mais comum de nao encontra-lo e
      // o callback ter rodado duas vezes (refresh na aba, botao voltar) — a
      // primeira ja gravou a integracao. Sem este log, os dois casos (replay
      // acidental e tentativa de CSRF) sao indistinguiveis depois do fato.
      logger.warn("Callback do Drive com state nao aproveitavel", {
        motivo: consumed.error,
      });
      return res.redirect(buildRedirectUrl("error", consumed.error));
    }

    /**
     * As duas etapas seguintes falham por motivos COMPLETAMENTE distintos, e um
     * catch único as tornava indistinguíveis — o usuário via "oauth_failed" e
     * não havia como saber se o problema era com o Google ou com a nossa
     * infraestrutura sem abrir o log da função.
     *
     * Troca do código: `redirect_uri` divergente, código já usado
     * (`invalid_grant`), credenciais do cliente OAuth erradas.
     * Gravação: KMS não configurado no ambiente, Firestore indisponível.
     */
    const oauthClient = await createDriveOAuthClient();

    let refreshToken: string;
    try {
      const { tokens } = await oauthClient.getToken(code);
      oauthClient.setCredentials(tokens);
      refreshToken = String(tokens.refresh_token || "").trim();
    } catch (error) {
      logger.error("Troca do código por token falhou no Google Drive", {
        error: error instanceof Error ? error.message : String(error),
      });
      return res.redirect(buildRedirectUrl("error", "token_exchange_failed"));
    }

    if (!refreshToken) {
      // Sem refresh token a conexão dura horas e morre sozinha. Falhar aqui é
      // melhor que gravar uma integração que vai parar sem explicação.
      return res.redirect(buildRedirectUrl("error", "missing_refresh_token"));
    }

    try {
      await saveDriveIntegration({
        tenantId: consumed.tenantId,
        uid: consumed.uid,
        refreshToken,
        connectedEmail: await fetchConnectedEmail(oauthClient),
      });
    } catch (error) {
      // O caso mais provável aqui é a chave KMS ausente no ambiente: o token
      // é cifrado antes de ser gravado, e sem a chave nada é persistido.
      logger.error("Falha ao gravar a integração do Google Drive", {
        error: error instanceof Error ? error.message : String(error),
      });
      return res.redirect(buildRedirectUrl("error", "save_failed"));
    }

    return res.redirect(buildRedirectUrl("connected"));
  } catch (error) {
    logger.error("Falha no callback do Google Drive", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.redirect(buildRedirectUrl("error", "oauth_failed"));
  }
}

// GET /v1/drive/google/status
export async function getDriveStatus(req: Request, res: Response) {
  try {
    const tenantId = resolveTenantId(req);
    if (!req.user?.uid || !tenantId) {
      return res.status(403).json({ message: "Tenant não identificado." });
    }

    const integration = await getDriveIntegration(tenantId);
    // O token NUNCA sai daqui, nem cifrado: a tela só precisa saber se está
    // conectado, a qual conta e em qual pasta.
    return res.json({
      success: true,
      // Conectado = TEM TOKEN. O documento sobrevive ao desconectar para
      // guardar a pasta escolhida, entao a existencia dele nao prova nada.
      connected: Boolean(integration?.refreshTokenEnc),
      // A conexão existe mas está morta: a tela precisa dizer isso ANTES de a
      // pessoa tentar usar, não depois.
      needsReconnect: integration?.lastError === "invalid_grant",
      connectedEmail: integration?.connectedEmail ?? null,
      rootFolderId: integration?.rootFolderId ?? null,
      rootFolderName: integration?.rootFolderName ?? null,
    });
  } catch (error) {
    logger.error("Falha ao consultar status do Drive", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res
      .status(500)
      .json({ message: "Não foi possível consultar a conexão com o Drive." });
  }
}

// DELETE /v1/drive/google/status
export async function disconnectDriveHandler(req: Request, res: Response) {
  try {
    const tenantId = resolveTenantId(req);
    if (!req.user?.uid || !tenantId) {
      return res.status(403).json({ message: "Tenant não identificado." });
    }
    if (!canManageIntegration(req)) {
      return res.status(403).json({
        message: "Somente administradores podem desconectar o Google Drive.",
      });
    }

    await disconnectDrive(tenantId);
    return res.json({
      success: true,
      message: "Google Drive desconectado. As pastas e os arquivos já enviados continuam no seu Drive.",
    });
  } catch (error) {
    logger.error("Falha ao desconectar o Drive", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res
      .status(500)
      .json({ message: "Não foi possível desconectar o Google Drive." });
  }
}

// PUT /v1/drive/google/root-folder
//
// O id vem do Google Picker, no navegador. É ele que "abre" a pasta para o app
// dentro do escopo `drive.file` — sem Picker não haveria como apontar uma pasta
// que já existe sem pedir um escopo restrito.
export async function setRootFolderHandler(req: Request, res: Response) {
  try {
    const tenantId = resolveTenantId(req);
    if (!req.user?.uid || !tenantId) {
      return res.status(403).json({ message: "Tenant não identificado." });
    }
    if (!canManageIntegration(req)) {
      return res.status(403).json({
        message: "Somente administradores podem escolher a pasta do Drive.",
      });
    }

    const body = req.body as { folderId?: unknown; folderName?: unknown };
    const folderId = String(body.folderId || "").trim();
    const folderName = String(body.folderName || "").trim();

    if (!DRIVE_ID_RE.test(folderId)) {
      return res.status(400).json({ message: "Pasta inválida." });
    }
    if (!(await getDriveIntegration(tenantId))) {
      return res
        .status(409)
        .json({ message: "Conecte a conta Google antes de escolher a pasta." });
    }

    await saveRootFolder(tenantId, folderId, folderName || "Pasta selecionada");
    // Marca também a pasta escolhida: sem isso só a criada por nós seria
    // reencontrada depois de um desconectar, e quem usou o Picker acabaria com
    // uma segunda pasta ao reconectar.
    await tagRootFolder(tenantId, folderId);
    return res.json({ success: true });
  } catch (error) {
    logger.error("Falha ao gravar a pasta raiz do Drive", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res
      .status(500)
      .json({ message: "Não foi possível salvar a pasta selecionada." });
  }
}

// POST /v1/drive/google/root-folder
//
// Cria a pasta raiz no Drive do usuário — o caminho PADRÃO, sem Picker.
//
// Funciona porque no escopo `drive.file` o acesso segue o arquivo, não o
// caminho: o usuário pode mover essa pasta para dentro da estrutura que já tem,
// renomear e compartilhar, que continuamos enxergando ela.
export async function createRootFolderHandler(req: Request, res: Response) {
  try {
    const tenantId = resolveTenantId(req);
    if (!req.user?.uid || !tenantId) {
      return res.status(403).json({ message: "Tenant não identificado." });
    }
    if (!canManageIntegration(req)) {
      return res.status(403).json({
        message: "Somente administradores podem criar a pasta do Drive.",
      });
    }

    const { folderId, folderName } = await createRootFolder(tenantId);
    await saveRootFolder(tenantId, folderId, folderName);

    return res.json({ success: true, folderId, folderName });
  } catch (error) {
    const err = error as Error;
    logger.error("Falha ao criar a pasta raiz no Drive", { error: err.message });
    if (isInvalidGrantError(err)) {
      await markNeedsReconnect(resolveTenantId(req));
    }
    return res
      .status(mapDriveErrorStatus(err))
      .json({ message: mapDriveErrorMessage(err), code: err.message });
  }
}

// GET /v1/drive/clients/:clientId/folder
//
// Devolve o link da pasta do cliente, criando-a se ainda não existir. É o que
// o botão "abrir pasta" do cadastro do contato consome.
export async function getClientFolderHandler(req: Request, res: Response) {
  try {
    const tenantId = resolveTenantId(req);
    if (!req.user?.uid || !tenantId) {
      return res.status(403).json({ message: "Tenant não identificado." });
    }
    // Quem abre a pasta é o vendedor, então segue a permissão de contatos — e
    // não o gate de master da configuração.
    if (
      !req.user.isSuperAdmin &&
      !isTenantAdminRole(req.user.role || "") &&
      !(await hasPagePermission(req.user, "contacts", "canView"))
    ) {
      return res.status(403).json({ message: "Sem permissão para ver contatos." });
    }

    const folderId = await ensureClientFolder(
      tenantId,
      String(req.params.clientId || ""),
    );
    return res.json({
      success: true,
      folderId,
      url: `https://drive.google.com/drive/folders/${folderId}`,
    });
  } catch (error) {
    const err = error as Error;
    logger.error("Falha ao resolver a pasta do cliente no Drive", {
      error: err.message,
    });
    if (isInvalidGrantError(err)) {
      await markNeedsReconnect(resolveTenantId(req));
    }
    return res.status(mapDriveErrorStatus(err)).json({
      message: mapDriveErrorMessage(err),
      code: err.message,
    });
  }
}

export const DRIVE_RECONNECT_MESSAGE =
  "A autorização do Google expirou ou foi revogada. Reconecte sua conta em Configurações → Google Drive.";

const DRIVE_ERROR_MESSAGES: Record<string, string> = {
  DRIVE_NAO_CONECTADO:
    "Conecte sua conta Google em Configurações → Google Drive antes de usar as pastas.",
  DRIVE_SEM_PASTA_RAIZ:
    "Escolha a pasta do Drive onde as pastas dos clientes devem ser criadas, em Configurações → Google Drive.",
  GOOGLE_DRIVE_NAO_CONFIGURADO:
    "A integração com o Google Drive não está configurada neste ambiente.",
  CLIENTE_NAO_ENCONTRADO: "Cliente não encontrado.",
  DRIVE_FALHA_AO_CRIAR_PASTA:
    "O Google não confirmou a criação da pasta. Tente novamente.",
};

/** Código interno não pode chegar na tela — ele não diz o que fazer. */
export function mapDriveErrorMessage(error: Error): string {
  if (isInvalidGrantError(error)) {
    return DRIVE_RECONNECT_MESSAGE;
  }
  return DRIVE_ERROR_MESSAGES[error.message] || error.message;
}

export function mapDriveErrorStatus(error: Error): number {
  // 409 e não 500: o pedido faz sentido, falta uma ação do usuário. Um 500
  // sugeriria bug nosso e mandaria a pessoa esperar em vez de reconectar.
  if (isInvalidGrantError(error)) return 409;
  if (error.message === "CLIENTE_NAO_ENCONTRADO") return 404;
  if (error.message === "CLIENTE_DE_OUTRO_TENANT") return 403;
  if (
    error.message === "DRIVE_NAO_CONECTADO" ||
    error.message === "DRIVE_SEM_PASTA_RAIZ"
  ) {
    // 409: o pedido faz sentido, falta um passo de configuração — 400 sugeriria
    // que o cliente mandou algo errado.
    return 409;
  }
  return 500;
}
