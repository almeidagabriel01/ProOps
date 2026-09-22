import React from "react";

import { cn } from "@/lib/utils";

import { HEROI_RAIZ, SEGMENTOS } from "../../_content/institucional-copy";
import { PRANCHAS, PRANCHA_EM_BRANCO, type Prancha } from "./pranchas";

/**
 * A cena do herói da raiz: uma prancheta no escuro, e uma luz que o visitante
 * carrega.
 *
 * As pranchas estão todas lá desde o primeiro byte, desenhadas em traço fino.
 * O que decide o que se vê é um VÉU: um degradê radial quase opaco, com um furo
 * onde a luz está. Onde a luz passa, o desenho de um ofício aparece com o nome
 * dele; a última prancha é uma folha em branco, com marcas de registro e o nome
 * de quem chegou agora.
 *
 * É a resposta à pergunta que faz alguém fechar a aba na primeira tela ("isto
 * serve para o meu negócio?") dita pelo lado da ProOps: todo mundo aqui desenha
 * o projeto antes de vender, e a folha em branco é o convite. Duas versões
 * anteriores desta dobra tentaram responder isso com uma LISTA (um anel de
 * rótulos, depois uma grade deles): informavam e não tinham cena nenhuma.
 *
 * **O véu é `background`, e não `mask`.** Os dois fazem o mesmo furo, mas o
 * degradê de fundo é uma pintura só, sem camada de máscara para compor a cada
 * quadro, e o mesmo elemento ainda carrega o halo da luz numa segunda camada de
 * fundo. Fora do furo ele não é 100% opaco de propósito: sobra uns 4% do traço,
 * o bastante para a composição existir antes de a luz chegar.
 *
 * Componente de SERVIDOR, sem JavaScript próprio. A luz segue `--px`/`--py`, as
 * duas variáveis que o `usePointerField` da casca já escreve; sem ponteiro fino
 * ela passeia sozinha por um keyframe. Sob movimento reduzido não há luz: o véu
 * vira um filtro parejo e a prancheta inteira fica legível, parada.
 */

/** Atraso relativo à abertura, como o resto do herói. */
function depois(segundos: number): string {
  return `calc(var(--espera, 0s) + ${segundos}s)`;
}

function Desenho({ prancha }: { prancha: Prancha }) {
  return (
    <svg viewBox="0 0 100 72" className="block w-full" fill="none">
      {prancha.guias?.map((d) => (
        <path key={d} className="prancha-guia" d={d} />
      ))}
      {prancha.tracos.map((d) => (
        <path key={d} className="prancha-traco" d={d} />
      ))}
      {prancha.discos?.map(([cx, cy, r]) => (
        <circle key={`${cx}-${cy}`} className="prancha-traco" cx={cx} cy={cy} r={r} />
      ))}
    </svg>
  );
}

interface FolhaProps {
  prancha: Prancha;
  rotulo: string;
  apoio?: string;
  ordem: number;
  emBranco?: boolean;
}

function Folha({ prancha, rotulo, apoio, ordem, emBranco }: FolhaProps) {
  const { x, y, largura, giro } = prancha.lugar;
  const celular = prancha.celular;
  return (
    <figure
      className={cn(
        "prancha hero-enter absolute",
        emBranco && "prancha--branco",
        // Sem lugar no celular, a prancha não existe ali: três desenhos
        // legíveis valem mais que sete espremidos.
        !celular && "hidden md:block",
      )}
      style={
        {
          "--prancha-x": `${x}%`,
          "--prancha-y": `${y}%`,
          "--prancha-w": `${largura}%`,
          "--prancha-xc": `${celular?.x ?? x}%`,
          "--prancha-yc": `${celular?.y ?? y}%`,
          "--prancha-wc": `${celular?.largura ?? largura}%`,
          "--prancha-giro": `${giro}deg`,
          "--hero-y": "10px",
          "--hero-dur": "0.9s",
          "--hero-delay": depois(0.24 + ordem * 0.06),
        } as React.CSSProperties
      }
    >
      <Desenho prancha={prancha} />
      <figcaption className="prancha-rotulo">
        {rotulo}
        {apoio && <span className="prancha-apoio">{apoio}</span>}
      </figcaption>
    </figure>
  );
}

const RESUMO = `A cena mostra a planta de ${SEGMENTOS.length} negócios que vendem projeto (${SEGMENTOS.map(
  (s) => s.nome.toLowerCase(),
).join(", ")}) e, no fim, uma folha em branco: o seu, configurado com as suas palavras.`;

export function Lanterna() {
  const { seu, seuApoio, pronto } = HEROI_RAIZ.lanterna;

  return (
    <>
      <div aria-hidden="true" className="lanterna absolute inset-0 overflow-hidden">
        <div className="lanterna-campo absolute inset-0">
          {SEGMENTOS.map((segmento, i) => (
            <Folha
              key={segmento.id}
              prancha={PRANCHAS[segmento.id]}
              rotulo={segmento.nome}
              apoio={segmento.pronto ? pronto : undefined}
              ordem={i}
            />
          ))}
          <Folha
            prancha={PRANCHA_EM_BRANCO}
            rotulo={seu}
            apoio={seuApoio}
            ordem={SEGMENTOS.length}
            emBranco
          />
        </div>

        {/* O véu: opaco fora da luz, furado onde ela está. */}
        <div className="lanterna-veu absolute inset-0" />
      </div>

      <p className="sr-only">{RESUMO}</p>
    </>
  );
}
