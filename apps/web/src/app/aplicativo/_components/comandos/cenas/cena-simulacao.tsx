"use client";

import React from "react";
import gsap from "gsap";

import { useCena } from "../use-cena";
import { Moeda, Rotulo, useValores } from "./pecas-da-cena";
import type { PropsDaCena } from "./tipos";

const LARGURA = 480;
const ALTURA = 230;
/** Onde o mês está hoje, e onde a linha se divide. */
const HOJE = { x: 214, y: 92 };
const ZERO_Y = 160;
const FIM_X = 466;
const FIM_SEM = 60;
const FIM_COM = 206;

const TRACOS = {
  ate: `M14 126 C58 120 92 112 128 108 S186 96 ${HOJE.x} ${HOJE.y}`,
  sem: `M${HOJE.x} ${HOJE.y} C290 88 380 74 ${FIM_X} ${FIM_SEM}`,
  com: `M${HOJE.x} ${HOJE.y} C228 92 232 184 250 188 S392 200 ${FIM_X} ${FIM_COM}`,
};

/** Posição em % da caixa, para os rótulos em HTML acompanharem o SVG. */
const pct = (x: number, y: number) => ({
  left: `${(x / LARGURA) * 100}%`,
  top: `${(y / ALTURA) * 100}%`,
});

/**
 * "posso comprar um celular de 3 mil?".
 *
 * Nada é lançado, e a cena precisa dizer isso sem texto: a linha do mês chega
 * até hoje e ali se BIFURCA. Um ramo segue o mês como ele é; o outro cai os
 * três mil de uma vez e atravessa o zero. Os dois terminam com o valor da sobra
 * ao lado, e o do ramo que atravessa fica na cor de perigo.
 *
 * O SVG não é esticado (`meet`), porque os pontos das pontas deformariam. Os
 * rótulos são HTML posicionados na mesma caixa de proporção fixa, em
 * porcentagem das coordenadas do desenho.
 */
export function CenaSimulacao({ armado, tocando }: PropsDaCena) {
  const raiz = React.useRef<HTMLDivElement>(null);
  const [valores, definir] = useValores({ sem: 1284.9, com: -1715.1 });

  useCena(
    raiz,
    (tl) => {
      const q = gsap.utils.selector(raiz);
      definir({ sem: 0, com: 0 });

      tl.fromTo(
        q(".simulacao-zero, .simulacao-hoje"),
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.5, stagger: 0.1 },
        0.1,
      )
        .fromTo(
          q(".simulacao-ate"),
          { strokeDashoffset: 1 },
          { strokeDashoffset: 0, duration: 1.1, ease: "power2.inOut" },
          0.2,
        )
        .fromTo(
          q(".simulacao-marco"),
          { scale: 0.4, opacity: 0, transformOrigin: "50% 50%" },
          { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(2.4)" },
          1.2,
        )
        .fromTo(
          q(".simulacao-sem, .simulacao-com"),
          { strokeDashoffset: 1 },
          {
            strokeDashoffset: 0,
            duration: 1.2,
            ease: "power3.inOut",
            stagger: 0.12,
          },
          1.45,
        )
        .fromTo(
          q(".simulacao-ponta"),
          { scale: 0.4, opacity: 0, transformOrigin: "50% 50%" },
          {
            scale: 1,
            opacity: 1,
            duration: 0.5,
            ease: "back.out(2.4)",
            stagger: 0.12,
          },
          2.45,
        )
        .fromTo(
          q(".simulacao-rotulo"),
          { autoAlpha: 0, y: 8 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.5,
            ease: "power3.out",
            stagger: 0.12,
          },
          2.5,
        )
        .call(() => definir({ sem: 1284.9 }), [], 2.6)
        .call(() => definir({ com: -1715.1 }), [], 2.75)
        .fromTo(
          q(".simulacao-legenda"),
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.6 },
          3.2,
        );

      return () => definir({ sem: 1284.9, com: -1715.1 });
    },
    { armado, tocando },
  );

  return (
    <div ref={raiz} className="flex h-full flex-col justify-center">
      <div
        className="relative w-full"
        style={{ aspectRatio: `${LARGURA} / ${ALTURA}` }}
      >
        <svg
          viewBox={`0 0 ${LARGURA} ${ALTURA}`}
          className="absolute inset-0 h-full w-full overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="simulacao-queda" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--app-text-muted)" />
              <stop offset="100%" stopColor="var(--app-danger)" />
            </linearGradient>
          </defs>
          <line
            className="simulacao-zero"
            x1={0}
            x2={LARGURA}
            y1={ZERO_Y}
            y2={ZERO_Y}
            stroke="var(--app-separator)"
            strokeDasharray="3 5"
          />
          <line
            className="simulacao-hoje"
            x1={HOJE.x}
            x2={HOJE.x}
            y1={24}
            y2={ALTURA - 6}
            stroke="var(--app-text)"
            strokeOpacity={0.12}
          />
          <path
            className="simulacao-ate"
            d={TRACOS.ate}
            pathLength={1}
            strokeDasharray="1"
            fill="none"
            stroke="var(--app-text)"
            strokeWidth={2.4}
            strokeLinecap="round"
          />
          <path
            className="simulacao-sem"
            d={TRACOS.sem}
            pathLength={1}
            strokeDasharray="1"
            fill="none"
            stroke="var(--app-tint)"
            strokeWidth={2.4}
            strokeLinecap="round"
          />
          <path
            className="simulacao-com"
            d={TRACOS.com}
            pathLength={1}
            strokeDasharray="1"
            fill="none"
            stroke="url(#simulacao-queda)"
            strokeWidth={2.4}
            strokeLinecap="round"
          />
          <circle
            className="simulacao-marco"
            cx={HOJE.x}
            cy={HOJE.y}
            r={5}
            fill="var(--app-bg)"
            stroke="var(--app-text)"
            strokeWidth={2}
          />
          <circle
            className="simulacao-ponta"
            cx={FIM_X}
            cy={FIM_SEM}
            r={5}
            fill="var(--app-tint)"
          />
          <circle
            className="simulacao-ponta"
            cx={FIM_X}
            cy={FIM_COM}
            r={5}
            fill="var(--app-danger)"
          />
        </svg>

        <span
          style={pct(HOJE.x + 8, 12)}
          className="simulacao-hoje absolute text-xs text-[var(--app-text-muted)]"
        >
          hoje
        </span>
        <span
          style={pct(6, ZERO_Y + 6)}
          className="simulacao-zero absolute [font-family:var(--font-jetbrains-mono)] text-[11px] text-[var(--app-text-muted)]"
        >
          R$ 0
        </span>

        {/* O posicionamento fica num invólucro e a animação no filho: o GSAP
            reescreve o `transform` de quem ele anima, e o `translate` que
            ancora o rótulo na ponta sumiria. */}
        <div
          style={{
            ...pct(FIM_X, FIM_SEM),
            transform: "translate(-100%, calc(-100% - 14px))",
          }}
          className="absolute"
        >
          <div className="simulacao-rotulo text-right">
            <Rotulo>Se não comprar</Rotulo>
            <Moeda
              valor={valores.sem}
              className="text-base font-semibold text-[var(--app-tint)] md:text-xl"
            />
          </div>
        </div>
        <div
          style={{
            ...pct(FIM_X, FIM_COM),
            transform: "translate(-100%, calc(-100% - 14px))",
          }}
          className="absolute"
        >
          <div className="simulacao-rotulo text-right">
            <Rotulo>Se comprar à vista</Rotulo>
            <Moeda
              valor={valores.com}
              className="text-base font-semibold text-[var(--app-danger)] md:text-xl"
            />
          </div>
        </div>
      </div>

      <p className="simulacao-legenda mt-6 text-sm text-[var(--app-text-muted)]">
        Nada foi lançado. Em 10x, a sobra do mês fica em R$ 984,90.
      </p>
    </div>
  );
}
