import { useSyncExternalStore } from "react";

/**
 * O assunto escolhido em /fale-conosco, compartilhado entre o herói e o
 * formulário.
 *
 * As duas peças estão longe uma da outra na árvore (o herói no topo, o
 * formulário duas seções abaixo), e as duas são ilhas de cliente dentro de uma
 * página de servidor: não há um pai comum de cliente para segurar o estado.
 * Um store de módulo lido por `useSyncExternalStore` resolve sem contexto, sem
 * `setState` em efeito e sem transformar a página inteira em cliente.
 *
 * O valor é o `titulo` do canal ("Comercial", "Suporte", "Parcerias") e não um
 * índice: um índice mudaria de sentido no dia em que alguém reordenasse
 * `CANAIS`, e o título é o que viaja com a mensagem como assunto.
 */

type Ouvinte = () => void;

let escolhido: string | null = null;
const ouvintes = new Set<Ouvinte>();

export function escolheCanal(titulo: string | null): void {
  if (escolhido === titulo) return;
  escolhido = titulo;
  for (const ouvinte of ouvintes) ouvinte();
}

function assina(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

const leitura = () => escolhido;
/** No servidor ninguém escolheu nada ainda: o formulário abre no primeiro. */
const leituraDoServidor = () => null;

export function useCanalEscolhido(): string | null {
  return useSyncExternalStore(assina, leitura, leituraDoServidor);
}
