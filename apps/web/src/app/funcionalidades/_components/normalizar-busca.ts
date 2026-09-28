/**
 * Minúsculas e sem acento: "comissão" acha "comissao" e vice-versa. O mesmo
 * tratamento vale para o texto indexado no servidor e para o que a pessoa
 * digita, senão os dois lados nunca batem.
 */
export function normalizarBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
