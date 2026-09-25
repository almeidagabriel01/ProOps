import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

/**
 * IP do cliente para rate limit, captcha e logs. Fonte única: antes havia oito
 * cópias, todas lendo o PRIMEIRO valor do `X-Forwarded-For`.
 *
 * Esse primeiro valor é de quem chama. As funções são públicas
 * (`cloudfunctions.net/api` aceita chamada direta, sem passar pela Vercel), e o
 * front do Google ACRESCENTA o IP real ao fim do cabeçalho em vez de
 * substituí-lo: um `X-Forwarded-For: 1.2.3.4` forjado virava a chave do
 * limitador, trocada a cada pedido para ganhar um balde novo.
 *
 * Ordem de confiança:
 * 1. O IP que o proxy da Vercel repassa (`x-proops-client-ip`), SÓ quando vem
 *    com o segredo compartilhado (`PROXY_CLIENT_IP_SECRET`). Sem isso, pelo
 *    proxy o backend só enxerga o IP de saída da Vercel, o mesmo para todos.
 * 2. O ÚLTIMO valor do `X-Forwarded-For`: o que o Google acrescentou, fora do
 *    alcance de quem chama.
 * 3. `req.ip` / socket (emulador, testes).
 *
 * Sem o segredo configurado o passo 1 é ignorado: nada fica mais aberto do que
 * o passo 2, só menos preciso para quem chega pelo proxy.
 */
export const PROXY_CLIENT_IP_HEADER = "x-proops-client-ip";
export const PROXY_SECRET_HEADER = "x-proops-proxy-secret";

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
}

function headerValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] ?? "");
  return String(value ?? "");
}

function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function trustedProxyIp(
  req: RequestLike,
  secret: string | undefined,
): string | null {
  const expected = String(secret ?? "").trim();
  if (!expected) return null;
  const provided = headerValue(req.headers[PROXY_SECRET_HEADER]).trim();
  if (!provided || !secretMatches(provided, expected)) return null;
  const ip = headerValue(req.headers[PROXY_CLIENT_IP_HEADER]).trim();
  return isIP(ip) ? ip : null;
}

function lastForwardedIp(req: RequestLike): string | null {
  const raw = req.headers["x-forwarded-for"];
  const joined = Array.isArray(raw) ? raw.join(",") : String(raw ?? "");
  const parts = joined
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const last = parts[parts.length - 1];
  return last ? last : null;
}

export function resolveClientIp(
  req: RequestLike,
  env: { PROXY_CLIENT_IP_SECRET?: string } = {
    PROXY_CLIENT_IP_SECRET: process.env.PROXY_CLIENT_IP_SECRET,
  },
): string {
  return (
    trustedProxyIp(req, env.PROXY_CLIENT_IP_SECRET) ??
    lastForwardedIp(req) ??
    req.ip ??
    req.socket?.remoteAddress ??
    "unknown"
  );
}
