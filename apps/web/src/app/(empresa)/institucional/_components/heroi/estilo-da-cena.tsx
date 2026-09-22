import React from "react";

import { LARGO_QUERY } from "../../_content/cena-planta";
import {
  ESTADO_FINAL,
  declaracoes,
  estadoDaCena,
  paraVariaveis,
} from "./roteiro";

/** O complemento exato de `LARGO_QUERY`, para as regras do retrato. */
const RETRATO_QUERY = "(max-width: 1023.98px)";

/**
 * As variáveis da cena no primeiro paint, geradas do roteiro no servidor.
 *
 * É aqui que as duas regras do site que parecem brigar ficam de pé juntas:
 *
 * - **acima da dobra é CSS**: quem chega vê o começo da história (a casa
 *   apagada, a proposta ainda fora do palco) sem esperar JavaScript nenhum;
 * - **a cena é escrita no estado final**: a regra BASE é `estadoDaCena(1)`, e o
 *   começo só vale dentro de `prefers-reduced-motion: no-preference`. Quem pede
 *   menos movimento recebe o quadro final composto, com a casa acesa, a
 *   proposta aprovada e a mensagem, e não uma cena parada no primeiro quadro.
 *
 * O diretor escreve as mesmas variáveis como estilo inline na seção, e estilo
 * inline vence qualquer regra daqui: a passagem do servidor para o cliente não
 * tem salto, porque as duas pontas saem da mesma função (`paraVariaveis`).
 *
 * A LARGO_QUERY aqui e no diretor é a mesma string, importada do mesmo lugar;
 * se um lado mudasse sozinho, o primeiro quadro de rolagem pularia de uma
 * composição para a outra.
 */
export function EstiloDaCena() {
  const inicio = estadoDaCena(0);
  const css = [
    `[data-cena-planta]{${declaracoes(paraVariaveis(ESTADO_FINAL, "largo"))}}`,
    `@media ${RETRATO_QUERY}{[data-cena-planta]{${declaracoes(paraVariaveis(ESTADO_FINAL, "retrato"))}}}`,
    `@media (prefers-reduced-motion: no-preference) and ${LARGO_QUERY}{[data-cena-planta]{${declaracoes(paraVariaveis(inicio, "largo"))}}}`,
    `@media (prefers-reduced-motion: no-preference) and ${RETRATO_QUERY}{[data-cena-planta]{${declaracoes(paraVariaveis(inicio, "retrato"))}}}`,
  ].join("");

  // Conteúdo gerado de números e nomes fixos do roteiro, nunca de entrada de
  // usuário: não há o que escapar.
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
