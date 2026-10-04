/**
 * O ID token mais recente, guardado por `identity-token-cache.ts` (que escuta
 * o Firebase) e lido em sincronia pelo relatório de erros e pelo registro de
 * atividade. Fica num módulo sem import do Firebase para quem só LÊ o token
 * não arrastar a inicialização do SDK (e todo teste que monta a tela não
 * precisar simular o Firebase).
 */

let cachedToken: string | null = null;

export function getCachedIdToken(): string | null {
  return cachedToken;
}

export function setCachedIdToken(token: string | null): void {
  cachedToken = token;
}
