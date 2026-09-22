import React from "react";
import Image from "next/image";

import { cn } from "@/lib/utils";

import {
  MARCOS,
  PESSOAS,
} from "@/app/(empresa)/institucional/_content/institucional-copy";

import { commitsDosMarcos } from "./git-log";

/** Altura de cada linha do log, em px. O grafo é desenhado sobre essa grade. */
const LINHA = 46;
/** O x de cada trilha do grafo. */
const TRILHA = [13, 33] as const;

const COMMITS = commitsDosMarcos(MARCOS);

/** O centro vertical da linha `i`. */
const meio = (i: number) => i * LINHA + LINHA / 2;

/**
 * O herói de /sobre: a história da empresa como o histórico de um repositório.
 *
 * O título diz que dois dos três sócios escrevem o código, e a cena mostra o
 * lugar onde isso fica registrado. Cada marco é um commit, do mais antigo
 * (embaixo) ao mais novo; o ERP segue no tronco e o aplicativo sai num ramo a
 * partir da mesma base, que é a tese de /produtos contada pelo outro lado.
 *
 * Os três sócios aparecem como os contribuidores do repositório, com o papel
 * de cada um tirado de `PESSOAS`: nenhuma autoria de marco é atribuída a
 * ninguém, porque isso seria afirmar um fato que a página não tem.
 *
 * Componente de servidor e zero JavaScript. O grafo se desenha de baixo para
 * cima (`.traco-desenha`), as linhas entram da mais antiga para a mais nova
 * (`.hero-enter`), e o conteúdo é texto de verdade, legível por leitor de tela
 * na ordem do log.
 */
export function HeroiGitLog() {
  const altura = COMMITS.length * LINHA;
  const tronco = COMMITS.map((c, i) => ({ c, i })).filter(({ c }) => c.trilha === 0);
  const primeiro = tronco[0].i;
  const ultimo = tronco[tronco.length - 1].i;
  const ramo = COMMITS.findIndex((c) => c.trilha === 1);

  return (
    <figure className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[var(--noite-alta)]/80 shadow-[0_40px_100px_-40px_rgb(0_0_0/0.9)] backdrop-blur-[2px]">
      <div aria-hidden="true" className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <span className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="block size-2.5 rounded-full bg-white/15" />
          ))}
        </span>
        <span className="[font-family:var(--font-geist-mono)] text-[11px] text-white/35">~/proops</span>
      </div>

      <div className="px-4 pb-5 pt-4 sm:px-5">
        <figcaption className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-white/10 pb-4">
          <span className="text-xs text-white/45">
            {PESSOAS.length} contribuidores
          </span>
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {PESSOAS.map((pessoa, i) => {
              const escreveCodigo = pessoa.formacao?.includes("Software") ?? false;
              return (
                <li
                  key={pessoa.nome}
                  className="hero-enter flex items-center gap-2"
                  style={{ "--hero-delay": `${0.5 + i * 0.08}s`, "--hero-y": "6px" } as React.CSSProperties}
                >
                  <span className="relative size-7 overflow-hidden rounded-full ring-1 ring-white/15">
                    <Image src={pessoa.foto} alt="" fill sizes="28px" className="object-cover" />
                  </span>
                  <span className="text-[12.5px] leading-tight">
                    <span className="block text-white">{pessoa.nome.split(" ")[0]}</span>
                    <span className="block text-white/45">
                      {escreveCodigo ? "escreve o código" : "comercial e financeiro"}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </figcaption>

        <p aria-hidden="true" className="mt-4 [font-family:var(--font-geist-mono)] text-[12px] text-white/40">
          <span className="text-[rgb(var(--tungstenio))]">$</span> git log --graph
        </p>

        <div className="relative mt-2">
          <svg
            aria-hidden="true"
            viewBox={`0 0 44 ${altura}`}
            width={44}
            height={altura}
            className="absolute left-0 top-0"
            fill="none"
          >
            {/* O tronco, desenhado da raiz (embaixo) para cima. */}
            <path
              className="traco-desenha"
              pathLength={1}
              d={`M${TRILHA[0]} ${meio(ultimo)}V${meio(primeiro)}`}
              stroke="rgb(var(--linha) / 0.55)"
              strokeWidth="1.5"
              style={{ "--traco-delay": "0.35s", "--traco-dur": "1.1s" } as React.CSSProperties}
            />
            {/* O ramo do aplicativo, saindo da ponta do ERP. */}
            {ramo >= 0 && (
              <path
                className="traco-desenha"
                pathLength={1}
                d={`M${TRILHA[0]} ${meio(ramo + 1)}C${TRILHA[0]} ${meio(ramo + 1) - LINHA * 0.55} ${TRILHA[1]} ${meio(ramo) + LINHA * 0.45} ${TRILHA[1]} ${meio(ramo)}`}
                stroke="rgb(var(--tungstenio) / 0.85)"
                strokeWidth="1.5"
                style={{ "--traco-delay": "1.35s", "--traco-dur": "0.6s" } as React.CSSProperties}
              />
            )}
            {COMMITS.map((commit, i) => (
              <circle
                key={commit.hash}
                cx={TRILHA[commit.trilha]}
                cy={meio(i)}
                r={4.5}
                className="hero-enter"
                fill={commit.trilha === 1 ? "rgb(var(--tungstenio))" : "var(--noite-alta)"}
                stroke={commit.trilha === 1 ? "rgb(var(--tungstenio))" : "rgb(var(--linha) / 0.9)"}
                strokeWidth="1.5"
                style={{ "--hero-delay": `${0.45 + (COMMITS.length - 1 - i) * 0.28}s`, "--hero-y": "0px" } as React.CSSProperties}
              />
            ))}
          </svg>

          <ol className="relative">
            {COMMITS.map((commit, i) => (
              <li
                key={commit.hash}
                className="hero-enter grid items-center gap-x-3 pl-[52px] text-[13px] sm:text-sm"
                style={
                  {
                    height: LINHA,
                    gridTemplateColumns: "auto 1fr auto",
                    "--hero-delay": `${0.5 + (COMMITS.length - 1 - i) * 0.28}s`,
                    "--hero-y": "8px",
                  } as React.CSSProperties
                }
              >
                <span className="[font-family:var(--font-geist-mono)] text-[12px] text-white/35">
                  {commit.hash}
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-white/90">{commit.titulo}</span>
                  {commit.ramo && (
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-1.5 py-px [font-family:var(--font-geist-mono)] text-[10.5px]",
                        commit.ramo === "aplicativo"
                          ? "border-[rgb(var(--tungstenio)/0.6)] text-[rgb(var(--tungstenio))]"
                          : "border-white/25 text-white/65",
                      )}
                    >
                      {commit.ramo}
                    </span>
                  )}
                </span>
                <span className="text-right text-[12px] tabular-nums text-white/40">{commit.ano}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </figure>
  );
}
