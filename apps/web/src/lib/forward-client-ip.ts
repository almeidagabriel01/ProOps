import "server-only";

/**
 * Repassa ao backend o IP real de quem chamou a Vercel.
 *
 * Sem isto o backend só enxerga o IP de saída da Vercel, o mesmo para todos os
 * usuários: um limitador "5 por minuto por IP" vira "5 por minuto para todo
 * mundo que sair pelo mesmo nó". O backend só aceita o valor quando o segredo
 * confere (`apps/functions/src/lib/client-ip.ts`), porque as funções também
 * são chamadas direto, sem passar por aqui.
 *
 * Na Vercel `x-real-ip` e `x-forwarded-for` são escritos pela borda, não pelo
 * cliente. Sem `PROXY_CLIENT_IP_SECRET` nada é enviado: o backend continua no
 * último valor do `X-Forwarded-For`, que é seguro, só menos preciso.
 */
export const PROXY_CLIENT_IP_HEADER = "x-proops-client-ip";
export const PROXY_SECRET_HEADER = "x-proops-proxy-secret";

export function applyClientIpForwarding(
  incoming: Headers,
  outgoing: Headers,
  secret: string | undefined = process.env.PROXY_CLIENT_IP_SECRET,
): void {
  const trimmedSecret = String(secret ?? "").trim();
  if (!trimmedSecret) return;
  const ip =
    incoming.get("x-real-ip")?.trim() ||
    incoming.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "";
  if (!ip) return;
  outgoing.set(PROXY_SECRET_HEADER, trimmedSecret);
  outgoing.set(PROXY_CLIENT_IP_HEADER, ip);
}
