import axios from "axios";
import { createHmac, timingSafeEqual } from "crypto";
import { v4 as uuidv4 } from "uuid";

export type MercadoPagoEnvironment = "sandbox" | "production";

export interface MercadoPagoTokens {
  accessToken: string;
  refreshToken: string;
  publicKey: string;
  userId: string;
  scope: string;
  expiresAt: string; // ISO — quando o access_token expira
  liveMode: boolean; // false = conta de teste, true = conta de produção
  environment: MercadoPagoEnvironment;
}

interface MercadoPagoOAuthResponse {
  access_token: string;
  refresh_token: string;
  public_key: string;
  user_id: number;
  scope: string;
  expires_in: number; // segundos até expirar
  live_mode: boolean; // authoritative: false for test accounts, true for production
}

interface OAuthStatePayload {
  tenantId: string;
  nonce: string;
}

export function deriveEnvironment(
  accessToken: string,
  liveMode: boolean,
): MercadoPagoEnvironment {
  if (accessToken.startsWith("TEST-")) return "sandbox";
  if (!liveMode) return "sandbox";
  return "production";
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function computeHmacSignature(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

function buildExpiresAt(expiresInSeconds: number): string {
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

function parseTokenResponse(data: MercadoPagoOAuthResponse): MercadoPagoTokens {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    publicKey: data.public_key,
    userId: String(data.user_id),
    scope: data.scope,
    expiresAt: buildExpiresAt(data.expires_in),
    liveMode: data.live_mode,
    environment: deriveEnvironment(data.access_token, data.live_mode),
  };
}

/**
 * Constrói a URL de autorização OAuth do Mercado Pago.
 * O state é um JSON base64 assinado com HMAC SHA256 para prevenir CSRF.
 */
export function buildOAuthUrl(tenantId: string): string {
  const appId = requireEnv("MERCADOPAGO_APP_ID");
  const redirectUri = requireEnv("MERCADOPAGO_OAUTH_REDIRECT_URI");
  const stateSecret = requireEnv("MERCADOPAGO_STATE_SECRET");

  const payload: OAuthStatePayload = { tenantId, nonce: uuidv4() };
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = computeHmacSignature(payloadBase64, stateSecret);
  const state = `${payloadBase64}.${signature}`;

  const url = new URL("https://auth.mercadopago.com/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "offline_access read write");

  return url.toString();
}

/**
 * Verifica a assinatura HMAC do state e extrai o payload.
 * Lança Error("INVALID_STATE") se a assinatura for inválida.
 */
export function verifyAndExtractState(state: string): OAuthStatePayload {
  const stateSecret = requireEnv("MERCADOPAGO_STATE_SECRET");

  const dotIndex = state.lastIndexOf(".");
  if (dotIndex === -1) {
    throw new Error("INVALID_STATE");
  }

  const payloadBase64 = state.substring(0, dotIndex);
  const providedSignature = state.substring(dotIndex + 1);
  const expectedSignature = computeHmacSignature(payloadBase64, stateSecret);

  const providedBuf = Buffer.from(providedSignature, "hex");
  const expectedBuf = Buffer.from(expectedSignature, "hex");

  if (
    providedBuf.length !== expectedBuf.length ||
    !timingSafeEqual(providedBuf, expectedBuf)
  ) {
    throw new Error("INVALID_STATE");
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadBase64, "base64url").toString("utf8"),
    ) as OAuthStatePayload;
    if (!parsed.tenantId || !parsed.nonce) {
      throw new Error("INVALID_STATE");
    }
    return parsed;
  } catch {
    throw new Error("INVALID_STATE");
  }
}

/**
 * Troca um authorization code por tokens de acesso via OAuth do Mercado Pago.
 */
export async function exchangeCodeForTokens(
  code: string,
): Promise<MercadoPagoTokens> {
  const appId = requireEnv("MERCADOPAGO_APP_ID");
  const clientSecret = requireEnv("MERCADOPAGO_CLIENT_SECRET");
  const redirectUri = requireEnv("MERCADOPAGO_OAUTH_REDIRECT_URI");

  const response = await axios.post<MercadoPagoOAuthResponse>(
    "https://api.mercadopago.com/oauth/token",
    {
      client_id: appId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    },
    { headers: { "Content-Type": "application/json" } },
  );

  return parseTokenResponse(response.data);
}

/**
 * Atualiza o access_token usando o refresh_token.
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<MercadoPagoTokens> {
  const appId = requireEnv("MERCADOPAGO_APP_ID");
  const clientSecret = requireEnv("MERCADOPAGO_CLIENT_SECRET");

  const response = await axios.post<MercadoPagoOAuthResponse>(
    "https://api.mercadopago.com/oauth/token",
    {
      client_id: appId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    },
    { headers: { "Content-Type": "application/json" } },
  );

  return parseTokenResponse(response.data);
}

/**
 * Revoga o access_token no Mercado Pago.
 * Operação best-effort — não lança erro se a revogação falhar.
 */
export async function revokeToken(accessToken: string): Promise<void> {
  const appId = requireEnv("MERCADOPAGO_APP_ID");
  const clientSecret = requireEnv("MERCADOPAGO_CLIENT_SECRET");

  await axios.post(
    "https://api.mercadopago.com/oauth/revoke",
    { client_id: appId, client_secret: clientSecret, token: accessToken },
    { headers: { "Content-Type": "application/json" } },
  );
}
