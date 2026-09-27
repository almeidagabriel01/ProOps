/**
 * Grava filtros de lista no endereço, para sobreviverem a voltar, recarregar
 * e compartilhar o link. Usa `history.replaceState`, que o App Router do Next
 * integra ao `useSearchParams` sem recarregar a página nem empilhar histórico.
 *
 * `null`, `undefined` e string vazia removem a chave: o valor padrão do filtro
 * não aparece no endereço.
 */
export function replaceUrlSearchParams(
  updates: Record<string, string | null | undefined>,
): void {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === "") {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
  }

  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== current) {
    window.history.replaceState(window.history.state, "", next);
  }
}
