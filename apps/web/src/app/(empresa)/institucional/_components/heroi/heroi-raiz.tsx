import React from "react";

import { EsperaDaAbertura } from "./espera-da-abertura";
import { Lanterna } from "./lanterna";
import { TextoDoHeroi } from "./texto-do-heroi";

import { HEROI_RAIZ } from "../../_content/institucional-copy";

/**
 * O herói da raiz do site da empresa.
 *
 * Ele fala da EMPRESA, e é a diferença que separa esta superfície da landing do
 * ERP: aqui não entra tela de produto nem fluxo de proposta. O título diz para
 * quem a ProOps faz software, e a cena atrás dele é uma prancheta no escuro,
 * com uma luz que o visitante carrega: onde ela passa aparece o desenho de um
 * ofício, e a última prancha é uma folha em branco com o nome dele.
 *
 * **A composição é de cartaz, não de SaaS.** O texto ancora embaixo, à
 * esquerda, e a cena ocupa a tela inteira por trás dele. As duas versões
 * anteriores punham o texto numa coluna e um bloco na outra, que é o layout de
 * qualquer página de produto, e a cena virava ilustração de canto.
 *
 * Uma versão ainda anterior abria com a cena da planta, do ambiente
 * especificado ao dinheiro. Ela ficou boa e está viva: mudou de endereço, para
 * a landing do ERP (`components/marketing/cena-planta/`), que é a página em que
 * "como o sistema funciona" é a pergunta do leitor. No site da empresa ela
 * respondia uma pergunta que ninguém tinha feito ainda, e pior: mostrava a
 * ProOps pelo exemplo de um nicho só, o que fazia quem vende outro tipo de
 * projeto se excluir na primeira tela.
 *
 * A entrada inteira é CSS (`.hero-enter`, `.hero-rise-line`), e os atrasos são
 * relativos a `--espera`, que a `EsperaDaAbertura` escreve: a escada do herói
 * só começa depois de as lâminas da abertura saírem, e numa volta por dentro do
 * site, em que a abertura não toca, ela começa na hora.
 */
export function HeroiRaiz() {
  const { convite, conviteToque, nota } = HEROI_RAIZ.lanterna;

  return (
    <EsperaDaAbertura
      aria-label="ProOps"
      className="superficie-noite relative isolate flex min-h-[100svh] flex-col overflow-hidden"
    >
      <Lanterna />

      {/* O texto fica legível esteja a luz onde estiver: uma sombra que desce
          para o canto do texto, por baixo dele e por cima da cena. */}
      <div aria-hidden="true" className="lanterna-sombra pointer-events-none absolute inset-0" />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-end px-6 pb-10 pt-28 md:px-10 md:pb-14">
        <TextoDoHeroi />

        <div className="mt-8 flex flex-col gap-2 border-t border-white/10 pt-5 text-[12.5px] leading-relaxed text-white/45 md:mt-10 md:flex-row md:items-center md:justify-between md:gap-6">
          <p className="max-w-md">{nota}</p>
          <p className="shrink-0 text-white/35">
            <span className="lanterna-convite--ponteiro">{convite}</span>
            <span className="lanterna-convite--toque">{conviteToque}</span>
          </p>
        </div>
      </div>
    </EsperaDaAbertura>
  );
}
