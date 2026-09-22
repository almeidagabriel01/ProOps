import React from "react";

import { CenaDoCiclo } from "./cena-do-ciclo";
import { EsperaDaAbertura } from "./espera-da-abertura";
import { TextoDoHeroi } from "./texto-do-heroi";

/**
 * O herói da raiz do site da empresa.
 *
 * Ele fala da EMPRESA, e é a diferença que separa esta superfície da landing do
 * ERP: aqui não entra tela de produto nem fluxo de proposta. A primeira dobra
 * conta de onde a ProOps veio (de dentro de uma operação que vende projeto) e
 * mostra o ciclo curto que é a consequência disso, com os rostos de quem usa e
 * de quem constrói nas duas pontas.
 *
 * Uma versão anterior abria com a cena da planta, do ambiente especificado ao
 * dinheiro na conta. Ela ficou boa e está viva: mudou de endereço, para a
 * landing do ERP (`components/marketing/cena-planta/`), que é a página em que
 * "como o sistema funciona" é a pergunta do leitor. No site da empresa ela
 * respondia uma pergunta que ninguém tinha feito ainda, e pior: mostrava a
 * ProOps pelo exemplo de um nicho só, o que fazia quem vende outro tipo de
 * projeto se excluir na primeira tela.
 *
 * A entrada inteira é CSS (`.hero-enter`, `.hero-rise-line`, `.traco-desenha`),
 * e os atrasos são relativos a `--espera`, que a `EsperaDaAbertura` escreve: a
 * escada do herói só começa depois de as lâminas da abertura saírem, e numa
 * volta por dentro do site, em que a abertura não toca, ela começa na hora.
 */
export function HeroiRaiz() {
  return (
    <EsperaDaAbertura
      aria-label="ProOps"
      className="superficie-noite relative isolate flex min-h-[100svh] flex-col justify-center overflow-hidden px-6 py-28 md:px-10 md:py-32"
    >
      <div aria-hidden="true" className="superficie-noite__luz pointer-events-none absolute inset-0" />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-14 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-7">
          <TextoDoHeroi />
        </div>
        <div className="lg:col-span-5">
          <CenaDoCiclo />
        </div>
      </div>
    </EsperaDaAbertura>
  );
}
