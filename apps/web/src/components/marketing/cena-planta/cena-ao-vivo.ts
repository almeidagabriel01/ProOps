import type { EstadoDaCena } from "./roteiro";

/**
 * O estado corrente da cena, compartilhado entre o diretor e o renderizador 3D.
 *
 * Um objeto mutável, e não contexto nem estado React, de propósito: o diretor
 * o atualiza a cada quadro de rolagem, e o three.js o lê dentro do próprio
 * loop. Passar isso por React seria um render por quadro para comunicar um
 * número que nenhum componente precisa mostrar.
 *
 * `versao` sobe a cada escrita. É o que deixa o 3D renderizar sob demanda:
 * sem versão nova e sem cortina se mexendo, o quadro anterior continua certo.
 */
export interface CenaAoVivo {
  estado: EstadoDaCena;
  versao: number;
}
