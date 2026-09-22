import React from "react";

import {
  HEROI_SOBRE,
  MARCOS,
} from "@/app/(empresa)/institucional/_content/institucional-copy";

/** Altura de cada marco, em px. A linha é desenhada sobre essa grade. */
const LINHA = 66;
/** O x das duas trilhas: o ERP e, depois da bifurcação, o aplicativo. */
const TRILHA = [14, 54] as const;
/** Quanto as duas pontas seguem depois do último marco. */
const SOBRA = 30;

/** O centro vertical do marco `i`. */
const meio = (i: number) => i * LINHA + LINHA / 2;

const ULTIMO = MARCOS.length - 1;
/** Onde as duas linhas param, e onde os nomes das pontas começam. */
const FIM = meio(ULTIMO) + SOBRA;
const ALTURA = FIM + 34;

/**
 * O herói de /sobre: a história da empresa como uma linha que se bifurca.
 *
 * Os quatro marcos, do mais antigo para o mais novo, numa linha vertical. No
 * último ela se divide: o ERP segue reto e o aplicativo sai ao lado, da mesma
 * base, e cada ponta leva o nome do produto que virou. É a tese de /produtos
 * contada pelo outro lado, e é o que a página tem a dizer sobre o tempo.
 *
 * **Uma versão anterior desenhou isto como um `git log`**, com hash, prompt e
 * janela de terminal. A geometria estava certa e o vocabulário não: a página
 * é lida por quem compra software, não por quem escreve, e "commit" e
 * "branch" pedem tradução justo na primeira tela. Sobrou a estrutura, que era
 * a parte boa, com as palavras da empresa.
 *
 * Nenhum marco é atribuído a sócio nenhum: isso seria afirmar um fato que a
 * página não tem.
 *
 * Componente de servidor e zero JavaScript. As linhas se desenham de cima
 * para baixo (`.traco-desenha`), os marcos entram na mesma ordem
 * (`.hero-enter`), e o conteúdo é texto de verdade, na ordem em que aconteceu.
 */
export function HeroiBifurcacao() {
  const curva = `M${TRILHA[0]} ${meio(ULTIMO - 1)}C${TRILHA[0]} ${meio(ULTIMO - 1) + LINHA * 0.55} ${TRILHA[1]} ${meio(ULTIMO) - LINHA * 0.55} ${TRILHA[1]} ${meio(ULTIMO)}V${FIM}`;

  return (
    <figure className="mx-auto w-full max-w-xl rounded-2xl border border-white/10 bg-[var(--noite-alta)]/70 px-5 py-6 shadow-[0_40px_100px_-40px_rgb(0_0_0/0.9)] backdrop-blur-[2px] sm:px-6">
      <figcaption className="mb-4 text-xs text-white/40">{HEROI_SOBRE.rotulo}</figcaption>

      <div className="relative" style={{ paddingBottom: ALTURA - MARCOS.length * LINHA }}>
        <svg
          aria-hidden="true"
          viewBox={`0 0 64 ${ALTURA}`}
          width={64}
          height={ALTURA}
          className="absolute left-0 top-0"
          fill="none"
        >
          {/* O ERP: a linha que vem do começo e não se interrompe. */}
          <path
            className="traco-desenha"
            pathLength={1}
            d={`M${TRILHA[0]} ${meio(0)}V${FIM}`}
            stroke="rgb(var(--linha) / 0.5)"
            strokeWidth="1.5"
            style={{ "--traco-delay": "0.35s", "--traco-dur": "1.1s" } as React.CSSProperties}
          />
          {/* O aplicativo: sai da mesma linha, na altura do último marco. */}
          <path
            className="traco-desenha"
            pathLength={1}
            d={curva}
            stroke="rgb(var(--linha) / 0.5)"
            strokeWidth="1.5"
            style={{ "--traco-delay": "1.25s", "--traco-dur": "0.7s" } as React.CSSProperties}
          />
          {MARCOS.map((marco, i) => {
            const noGalho = i === ULTIMO;
            return (
              <circle
                key={marco.titulo}
                cx={TRILHA[noGalho ? 1 : 0]}
                cy={meio(i)}
                r={4.5}
                className="hero-enter"
                fill={noGalho ? "rgb(var(--luz))" : "var(--noite-alta)"}
                stroke={noGalho ? "rgb(var(--luz))" : "rgb(var(--linha) / 0.9)"}
                strokeWidth="1.5"
                style={{ "--hero-delay": `${0.45 + i * 0.26}s`, "--hero-y": "0px" } as React.CSSProperties}
              />
            );
          })}
        </svg>

        <ol className="relative">
          {MARCOS.map((marco, i) => (
            <li
              key={marco.titulo}
              className="hero-enter grid items-center gap-x-3 pl-[76px] text-[13px] sm:text-sm"
              style={
                {
                  height: LINHA,
                  gridTemplateColumns: "1fr auto",
                  "--hero-delay": `${0.5 + i * 0.26}s`,
                  "--hero-y": "8px",
                } as React.CSSProperties
              }
            >
              <span className="min-w-0 text-white/90">{marco.titulo}</span>
              <span className="text-right text-[12px] tabular-nums text-white/40">{marco.ano}</span>
            </li>
          ))}
        </ol>

        {/* O nome de cada ponta, embaixo da linha que virou aquele produto. */}
        {[HEROI_SOBRE.tronco, HEROI_SOBRE.galho].map((nome, i) => (
          <span
            key={nome}
            className="hero-enter absolute whitespace-nowrap text-[11.5px] leading-none text-white"
            style={
              {
                left: TRILHA[i] - 3,
                top: FIM + 12,
                "--hero-delay": `${1.7 + i * 0.12}s`,
                "--hero-y": "4px",
              } as React.CSSProperties
            }
          >
            {nome}
          </span>
        ))}
      </div>

      <p className="mt-5 border-t border-white/10 pt-4 text-[12.5px] leading-relaxed text-white/45">
        {HEROI_SOBRE.nota}
      </p>
    </figure>
  );
}
