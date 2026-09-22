import React from "react";
import Image from "next/image";

import { HEROI_RAIZ, PESSOAS } from "../../_content/institucional-copy";

/**
 * A cena do herói da raiz: o ciclo curto entre quem usa e quem constrói.
 *
 * É a única coisa que esta empresa tem e que um concorrente não copia numa
 * semana: quem atende é quem escreve o código, e o primeiro usuário do ERP é
 * sócio da casa. O desenho é um anel que se fecha entre dois nós, com uma gota
 * correndo nele para o ciclo se ler como ciclo, e não como diagrama parado.
 *
 * Os retratos saem de `PESSOAS`, e a divisão entre os dois nós é fato do
 * arquivo de copy, não invenção daqui: quem tem formação em software está do
 * lado de quem constrói, e o sócio comercial é o primeiro usuário. Nomes,
 * papéis e falas continuam sendo de `/sobre`; aqui eles são rosto e posição.
 *
 * Componente de servidor, sem JavaScript: o anel se desenha com
 * `.traco-desenha` e a gota corre com `.ciclo-gota`, ambas paradas no estado
 * final sob movimento reduzido.
 */

const CONSTROEM = PESSOAS.filter((p) => p.formacao?.includes("Software"));
const USAM = PESSOAS.filter((p) => !p.formacao?.includes("Software"));

/** O caminho do anel, em coordenadas do viewBox de 320x320. */
const ANEL = "M160 34a126 126 0 1 1 0 252 126 126 0 1 1 0-252";

function Retratos({ pessoas, classe }: { pessoas: typeof PESSOAS; classe: string }) {
  return (
    <span className={classe}>
      {pessoas.map((pessoa) => (
        <span
          key={pessoa.nome}
          className="relative -ml-2 block size-9 overflow-hidden rounded-full ring-2 ring-[var(--noite)] first:ml-0 md:size-11"
        >
          <Image src={pessoa.foto} alt="" fill sizes="44px" className="object-cover" />
        </span>
      ))}
    </span>
  );
}

export function CenaDoCiclo() {
  const { usa, constroi, meio } = HEROI_RAIZ.ciclo;

  return (
    <div
      aria-hidden="true"
      className="ciclo relative mx-auto aspect-square w-full max-w-[24rem] md:max-w-[27rem]"
    >
      <svg viewBox="0 0 320 320" fill="none" className="absolute inset-0 h-full w-full">
        <path
          className="traco-desenha"
          pathLength={1}
          d={ANEL}
          stroke="rgb(var(--linha) / 0.45)"
          strokeWidth="1.25"
          style={
            {
              "--traco-delay": "calc(var(--espera, 0s) + 0.45s)",
              "--traco-dur": "1.6s",
            } as React.CSSProperties
          }
        />
        <path
          className="ciclo-gota"
          pathLength={1}
          d={ANEL}
          stroke="rgb(var(--tungstenio))"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>

      {/* Os dois nós, um em cada ponta do anel. */}
      <div className="absolute left-1/2 top-[6%] w-[74%] -translate-x-1/2 text-center">
        <Retratos pessoas={USAM} classe="mb-3 flex justify-center" />
        <p className="text-sm font-semibold text-white">{usa.titulo}</p>
        <p className="mt-1 text-[13px] leading-snug text-white/50">{usa.texto}</p>
      </div>

      <div className="absolute bottom-[6%] left-1/2 w-[78%] -translate-x-1/2 text-center">
        <Retratos pessoas={CONSTROEM} classe="mb-3 flex justify-center" />
        <p className="text-sm font-semibold text-white">{constroi.titulo}</p>
        <p className="mt-1 text-[13px] leading-snug text-white/50">{constroi.texto}</p>
      </div>

      {/* O meio do anel: o que o ciclo curto significa, em três palavras. */}
      <p className="absolute left-1/2 top-1/2 w-[58%] -translate-x-1/2 -translate-y-1/2 text-center [font-family:var(--font-bricolage)] text-lg font-semibold leading-tight tracking-tight text-white/85 md:text-xl">
        {meio}
      </p>
    </div>
  );
}
