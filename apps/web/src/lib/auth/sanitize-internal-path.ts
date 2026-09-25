/**
 * Reduz um destino vindo da URL (`?next=`, `?redirect=`) a um caminho da
 * própria origem, ou devolve o `fallback`.
 *
 * Checar só `startsWith("/") && !startsWith("//")` não basta: o parser de URL
 * do navegador trata `\` como `/` e descarta TAB e quebra de linha, então
 * `/\evil.com` e `/%09/evil.com` viram `//evil.com` na hora de navegar. Com um
 * link `…/auth/refresh?next=/%5Cevil.com`, quem estava logado saía do domínio
 * da ProOps direto para outro site. Aqui o destino é resolvido pelo mesmo
 * parser e só passa se a origem continuar a mesma.
 */
const INTERNAL_BASE = "https://internal.invalid";

export function sanitizeInternalPath(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  if (!decoded.startsWith("/")) return fallback;
  // Nenhum destino legítimo do produto tem barra invertida ou caractere de
  // controle; recusar antes de resolver evita depender de como cada parser os
  // normaliza.
  if (/[\\\u0000-\u001f\u007f]/.test(decoded)) return fallback;
  let resolved: URL;
  try {
    resolved = new URL(decoded, INTERNAL_BASE);
  } catch {
    return fallback;
  }
  if (resolved.origin !== INTERNAL_BASE) return fallback;
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}
