/**
 * Conexao com o Google Drive.
 *
 * Espelha o fluxo OAuth do Google Agenda — mesmo app OAuth
 * (`GOOGLE_CALENDAR_CLIENT_ID`/`_SECRET`), mesmo padrao de `state` com TTL,
 * mesma cifra KMS — mas com **consentimento SEPARADO**, e isso e deliberado:
 *
 * O refresh token guardado vale para os escopos concedidos quando ele nasceu.
 * Acrescentar `drive.file` a lista do Calendar invalidaria todos os
 * consentimentos existentes, e cada cliente com a Agenda conectada passaria a
 * receber "insufficient authentication scopes" ate reconectar — o mesmo
 * estrago que o comentario de `GOOGLE_CALENDAR_SCOPES` descreve. Com dois
 * consentimentos, ligar o Drive nao encosta em quem so usa a Agenda, e quem so
 * quer o Drive nao precisa conceder acesso aos proprios eventos.
 *
 * **Escopo `drive.file`, nao `drive`/`drive.readonly`.** O Google classifica
 * `drive.file` como **nao sensivel**: o app enxerga apenas o que ele mesmo
 * criou ou o que o usuario escolheu explicitamente pelo Google Picker. Os
 * escopos amplos sao **restritos** e disparam o security assessment CASA,
 * refeito a cada 12 meses enquanto o app existir — custo recorrente de
 * auditoria para uma funcionalidade que so precisa ENTREGAR arquivo.
 *
 * A consequencia de projeto: **nao conseguimos LISTAR as pastas do usuario**.
 * A pasta raiz e apontada por ele via Google Picker, que e o mecanismo oficial
 * de "abrir" um item para o app sem sair do escopo nao sensivel.
 */

import crypto from "crypto";
import { db } from "../../../init";
import { logger } from "../../../lib/logger";
import { resolveFrontendAppOrigin } from "../../../lib/frontend-app-url";
import { encryptToken, decryptToken } from "../../../lib/token-encryption";

/** Lazy pelo mesmo motivo do Calendar: manter o pacote fora do cold start. */
type DriveApi = typeof import("@googleapis/drive");
let driveApiPromise: Promise<DriveApi> | undefined;
export function loadDriveApi(): Promise<DriveApi> {
  if (!driveApiPromise) {
    driveApiPromise = import("@googleapis/drive");
  }
  return driveApiPromise;
}

type OAuth2Api = typeof import("@googleapis/oauth2");
let oauth2ApiPromise: Promise<OAuth2Api> | undefined;
function loadOAuth2Api(): Promise<OAuth2Api> {
  if (!oauth2ApiPromise) {
    oauth2ApiPromise = import("@googleapis/oauth2");
  }
  return oauth2ApiPromise;
}

export const DRIVE_INTEGRATIONS_COLLECTION = "google_drive_integrations";
export const DRIVE_OAUTH_STATES_COLLECTION = "drive_oauth_states";

/**
 * `drive.file` da acesso so ao que o app cria ou o usuario escolhe no Picker.
 * `userinfo.email` existe para a tela dizer QUAL conta esta conectada — sem
 * isso ela diz "conectado" sem dizer a quem, e conectar a conta errada fica
 * invisivel ate os arquivos aparecerem no Drive de outra pessoa.
 */
export const GOOGLE_DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
];

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export interface DriveIntegrationDocument {
  tenantId: string;
  provider: "google";
  connectedEmail: string | null;
  /** Refresh token cifrado em KMS. Nunca gravado em claro. */
  refreshTokenEnc: string;
  scopes: string[];
  /** Pasta raiz apontada pelo usuario no Picker. */
  rootFolderId: string | null;
  rootFolderName: string | null;
  connectedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  lastError: string | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function getDriveIntegration(
  tenantId: string,
): Promise<DriveIntegrationDocument | null> {
  const snapshot = await db
    .collection(DRIVE_INTEGRATIONS_COLLECTION)
    .doc(tenantId)
    .get();
  return snapshot.exists ? (snapshot.data() as DriveIntegrationDocument) : null;
}

export function resolveDriveRedirectUri(): string {
  const configured = String(process.env.GOOGLE_DRIVE_REDIRECT_URI || "").trim();
  if (configured) {
    return configured;
  }
  // Derivada da origem configurada (APP_URL), nunca de cabecalho da request: o
  // host de uma request pode ser forjado para influenciar o `redirect_uri`.
  return `${resolveFrontendAppOrigin()}/api/backend/v1/drive/google/callback`;
}

/**
 * Origem do app para ONDE devolver o navegador depois do OAuth.
 *
 * Precisa ser a mesma origem do `redirect_uri`, e nao a derivada de `APP_URL`:
 * quando a sobrescrita esta definida — o caso de testar localmente contra o
 * backend implantado —, `resolveFrontendAppOrigin()` aponta para outro
 * ambiente, e o usuario terminava o consentimento sendo jogado para fora da
 * aplicacao onde comecou.
 */
export function resolveDriveAppOrigin(): string {
  const configured = String(process.env.GOOGLE_DRIVE_REDIRECT_URI || "").trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // URI malformada: cair no default e melhor que estourar no meio do OAuth.
    }
  }
  return resolveFrontendAppOrigin();
}

export async function createDriveOAuthClient() {
  const clientId = String(process.env.GOOGLE_CALENDAR_CLIENT_ID || "").trim();
  const clientSecret = String(
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET || "",
  ).trim();

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_DRIVE_NAO_CONFIGURADO");
  }

  const { auth } = await loadDriveApi();
  return new auth.OAuth2(clientId, clientSecret, resolveDriveRedirectUri());
}

/** Guarda o `state` do OAuth com TTL — a mesma protecao de CSRF do Calendar. */
export async function createOAuthState(
  uid: string,
  tenantId: string,
): Promise<string> {
  const state = crypto.randomUUID();
  await db.collection(DRIVE_OAUTH_STATES_COLLECTION).doc(state).set({
    uid,
    tenantId,
    createdAt: nowIso(),
    expiresAtMs: Date.now() + OAUTH_STATE_TTL_MS,
  });
  return state;
}

export type ConsumedState =
  | { uid: string; tenantId: string }
  | { error: "invalid_state" | "expired_state" };

/**
 * Le e APAGA o `state`.
 *
 * Consumir de uma vez impede replay: um `code` interceptado nao pode ser
 * trocado duas vezes pelo mesmo `state`.
 */
export async function consumeOAuthState(state: string): Promise<ConsumedState> {
  const ref = db.collection(DRIVE_OAUTH_STATES_COLLECTION).doc(state);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    return { error: "invalid_state" };
  }

  const data = snapshot.data() as
    | { uid?: string; tenantId?: string; expiresAtMs?: number }
    | undefined;
  await ref.delete().catch(() => undefined);

  if (!data?.uid || !data.tenantId) {
    return { error: "invalid_state" };
  }
  if (typeof data.expiresAtMs === "number" && Date.now() > data.expiresAtMs) {
    return { error: "expired_state" };
  }
  return { uid: data.uid, tenantId: data.tenantId };
}

export async function saveDriveIntegration(params: {
  tenantId: string;
  uid: string;
  refreshToken: string;
  connectedEmail: string | null;
}): Promise<void> {
  const existente = await getDriveIntegration(params.tenantId);
  const agora = nowIso();

  await db
    .collection(DRIVE_INTEGRATIONS_COLLECTION)
    .doc(params.tenantId)
    .set({
      tenantId: params.tenantId,
      provider: "google",
      connectedEmail: params.connectedEmail,
      // Mesma chave KMS do Calendar (`CALENDAR_TOKEN`): e a mesma classe de
      // segredo — refresh token do MESMO provedor, do MESMO tenant. Uma chave
      // propria exigiria provisionamento manual no GCP e bloquearia a entrega
      // sem separar risco de verdade.
      refreshTokenEnc: await encryptToken(params.refreshToken, "CALENDAR_TOKEN"),
      scopes: GOOGLE_DRIVE_SCOPES,
      // A raiz sobrevive a uma reconexao: reconectar por consentimento expirado
      // nao deveria obrigar a apontar a pasta de novo.
      rootFolderId: existente?.rootFolderId ?? null,
      rootFolderName: existente?.rootFolderName ?? null,
      connectedByUserId: params.uid,
      createdAt: existente?.createdAt ?? agora,
      updatedAt: agora,
      lastError: null,
    } satisfies DriveIntegrationDocument);
}

export async function saveRootFolder(
  tenantId: string,
  folderId: string,
  folderName: string,
): Promise<void> {
  await db.collection(DRIVE_INTEGRATIONS_COLLECTION).doc(tenantId).update({
    rootFolderId: folderId,
    rootFolderName: folderName,
    updatedAt: nowIso(),
  });
}

export async function disconnectDrive(tenantId: string): Promise<void> {
  // Apaga o documento inteiro, pasta raiz inclusive: o token nao serve mais, e
  // guardar o id de uma pasta que nao conseguimos mais acessar so faria a tela
  // mentir sobre estar configurada.
  await db.collection(DRIVE_INTEGRATIONS_COLLECTION).doc(tenantId).delete();
}

/**
 * O Google recusou RENOVAR o acesso — a autorizacao nao existe mais.
 *
 * Nao e falha transitoria e nao adianta tentar de novo: acontece quando o
 * usuario revoga o acesso do app na conta Google, troca a senha, ou o refresh
 * token passa 6 meses sem uso. A unica saida e reconectar, e a mensagem tem que
 * dizer isso — `invalid_grant` cru num 500 nao ajuda ninguem.
 */
export function isInvalidGrantError(error: unknown): boolean {
  const texto =
    error instanceof Error ? error.message : String(error ?? "");
  return /invalid_grant|invalid_rapt|Token has been expired or revoked/i.test(
    texto,
  );
}

/**
 * Marca a integracao como precisando de reconexao.
 *
 * Sem isto a tela de configuracao continuaria dizendo "Conectado" sobre uma
 * autorizacao morta, e o usuario so descobriria ao tentar usar — provavelmente
 * no pior momento, com a proposta ja aprovada.
 */
export async function markNeedsReconnect(tenantId: string): Promise<void> {
  await db
    .collection(DRIVE_INTEGRATIONS_COLLECTION)
    .doc(tenantId)
    .update({ lastError: "invalid_grant", updatedAt: nowIso() })
    .catch(() => undefined);
}

/**
 * Cliente do Drive ja autenticado para o tenant.
 *
 * @throws `DRIVE_NAO_CONECTADO` quando nao ha integracao — quem chama traduz
 * isso em mensagem acionavel em vez de deixar vazar erro do provedor.
 */
export async function getDriveClient(tenantId: string) {
  const integration = await getDriveIntegration(tenantId);
  if (!integration?.refreshTokenEnc) {
    throw new Error("DRIVE_NAO_CONECTADO");
  }

  const oauthClient = await createDriveOAuthClient();
  oauthClient.setCredentials({
    refresh_token: await decryptToken(
      integration.refreshTokenEnc,
      "CALENDAR_TOKEN",
    ),
  });

  const { drive } = await loadDriveApi();
  return { client: drive({ version: "v3", auth: oauthClient }), integration };
}

/** E-mail da conta que autorizou — so para a tela dizer QUEM esta conectado. */
export async function fetchConnectedEmail(
  oauthClient: Awaited<ReturnType<typeof createDriveOAuthClient>>,
): Promise<string | null> {
  try {
    const oauth2Api = await loadOAuth2Api();
    const oauth2 = oauth2Api.oauth2({ version: "v2", auth: oauthClient });
    const info = await oauth2.userinfo.get();
    return String(info.data.email || "").trim() || null;
  } catch (error) {
    // Nao e motivo para falhar a conexao: o token ja foi obtido e o Drive
    // funciona sem sabermos o e-mail.
    logger.warn("Nao foi possivel ler o e-mail da conta Google do Drive", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
