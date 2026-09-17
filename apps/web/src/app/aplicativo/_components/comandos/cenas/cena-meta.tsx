"use client";

import React from "react";
import gsap from "gsap";

import { useCena } from "../use-cena";
import { Moeda, Rotulo, useValores } from "./pecas-da-cena";
import type { PropsDaCena } from "./tipos";

const OBJETIVO = 4000;
const GUARDADO = { antes: 1500, depois: 1700 };
const FALTAM = {
  antes: OBJETIVO - GUARDADO.antes,
  depois: OBJETIVO - GUARDADO.depois,
};
const RAIO = 52;

/**
 * "guarda 200 na meta da viagem".
 *
 * O depósito cai DENTRO do anel e é absorvido por ele: a ficha desce, encolhe
 * no centro, e o arco avança o pedaço correspondente enquanto os dois números
 * trocam. "Faltam" é o número que a pessoa realmente quer ver, e por isso ele
 * tem o mesmo peso do guardado, ao lado, e não uma nota embaixo.
 *
 * O arco usa `pathLength={100}`, então o progresso é escrito em porcentagem
 * direto no `strokeDasharray`, sem conta de circunferência.
 */
export function CenaMeta({ armado, tocando }: PropsDaCena) {
  const raiz = React.useRef<HTMLDivElement>(null);
  const [valores, definir] = useValores({
    guardado: GUARDADO.depois,
    faltam: FALTAM.depois,
  });
  const antes = (GUARDADO.antes / OBJETIVO) * 100;
  const depois = (GUARDADO.depois / OBJETIVO) * 100;

  useCena(
    raiz,
    (tl) => {
      const q = gsap.utils.selector(raiz);
      const deposito = q<HTMLElement>(".meta-deposito")[0];
      const anel = q<HTMLElement>(".meta-anel")[0];
      if (!deposito || !anel) return;
      // Quanto a ficha desce até o centro do anel, medido: animar `top` faria
      // layout a cada quadro, e `y` fica no compositor.
      const queda =
        anel.getBoundingClientRect().top +
        anel.getBoundingClientRect().height / 2 -
        (deposito.getBoundingClientRect().top +
          deposito.getBoundingClientRect().height / 2);
      definir({ guardado: GUARDADO.antes, faltam: FALTAM.antes });

      tl.fromTo(
        q(".meta-anel"),
        { autoAlpha: 0, scale: 0.9, rotation: -30, transformOrigin: "50% 50%" },
        {
          autoAlpha: 1,
          scale: 1,
          rotation: 0,
          duration: 0.9,
          ease: "expo.out",
        },
        0.05,
      )
        .fromTo(
          q(".meta-arco"),
          { strokeDasharray: "0 100" },
          {
            strokeDasharray: `${antes} 100`,
            duration: 0.9,
            ease: "power3.out",
          },
          0.2,
        )
        .fromTo(
          q(".meta-lado"),
          { autoAlpha: 0, x: 12 },
          {
            autoAlpha: 1,
            x: 0,
            duration: 0.6,
            ease: "power3.out",
            stagger: 0.1,
          },
          0.3,
        )
        // A ficha para ACIMA do anel, onde não cobre nada, e só então cai.
        .fromTo(
          q(".meta-deposito"),
          { autoAlpha: 0, y: "-=40", scale: 1 },
          { autoAlpha: 1, y: 0, duration: 0.55, ease: "power3.out" },
          1.1,
        )
        .to(
          q(".meta-deposito"),
          {
            y: queda,
            scale: 0.4,
            autoAlpha: 0,
            duration: 0.5,
            ease: "power3.in",
          },
          1.9,
        )
        .to(
          q(".meta-arco"),
          { strokeDasharray: `${depois} 100`, duration: 0.9, ease: "expo.out" },
          2.35,
        )
        .fromTo(
          q(".meta-brilho"),
          { autoAlpha: 0.8, scale: 0.9, transformOrigin: "50% 50%" },
          {
            autoAlpha: 0,
            scale: 1.15,
            duration: 0.9,
            ease: "power2.out",
            // O estado inicial dele é aceso: escrito na montagem, o anel
            // nasceria brilhando dois segundos antes do depósito.
            immediateRender: false,
          },
          2.35,
        )
        .call(() => definir({ guardado: GUARDADO.depois }), [], 2.35)
        .call(() => definir({ faltam: FALTAM.depois }), [], 2.5);

      return () =>
        definir({ guardado: GUARDADO.depois, faltam: FALTAM.depois });
    },
    { armado, tocando },
  );

  return (
    <div
      ref={raiz}
      className="flex h-full flex-col items-center justify-center gap-8 md:flex-row md:gap-12"
    >
      <div className="relative aspect-square w-56 shrink-0 md:w-64">
        <svg
          viewBox="0 0 120 120"
          aria-hidden="true"
          className="meta-anel absolute inset-0 h-full w-full"
        >
          <circle
            cx="60"
            cy="60"
            r={RAIO}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={9}
          />
          {[25, 50, 75].map((marca) => (
            <line
              key={marca}
              x1="60"
              y1="3"
              x2="60"
              y2="9"
              stroke="var(--app-separator)"
              strokeWidth={1}
              transform={`rotate(${marca * 3.6} 60 60)`}
            />
          ))}
          <circle
            className="meta-brilho"
            cx="60"
            cy="60"
            r={RAIO}
            fill="none"
            stroke="var(--app-tint)"
            strokeOpacity={0.35}
            strokeWidth={14}
            opacity={0}
          />
          <circle
            className="meta-arco"
            cx="60"
            cy="60"
            r={RAIO}
            fill="none"
            stroke="var(--app-tint)"
            strokeWidth={9}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${depois} 100`}
            transform="rotate(-90 60 60)"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <Rotulo>Viagem</Rotulo>
          <Moeda
            valor={valores.guardado}
            className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[var(--app-text)] md:text-[1.7rem]"
          />
          <p className="mt-1 text-xs text-[var(--app-text-muted)]">
            de R$ 4.000,00
          </p>
        </div>

        <span
          aria-hidden="true"
          className="meta-deposito absolute -top-12 left-1/2 -ml-[3.25rem] -mt-4 flex h-8 w-[6.5rem] items-center justify-center rounded-full bg-[var(--app-tint)] [font-family:var(--font-jetbrains-mono)] text-xs font-semibold text-[var(--app-on-tint)] opacity-0 shadow-[0_12px_30px_-10px_rgba(109,220,158,0.7)]"
        >
          + R$ 200,00
        </span>
      </div>

      <dl className="grid w-full max-w-xs grid-cols-2 gap-4 md:w-auto md:grid-cols-1 md:gap-6">
        <div className="meta-lado">
          <dt>
            <Rotulo>Depósito de hoje</Rotulo>
          </dt>
          <dd className="mt-1 [font-family:var(--font-jetbrains-mono)] text-xl font-semibold text-[var(--app-tint)]">
            R$ 200,00
          </dd>
        </div>
        <div className="meta-lado">
          <dt>
            <Rotulo>Faltam</Rotulo>
          </dt>
          <dd className="mt-1">
            <Moeda
              valor={valores.faltam}
              className="text-xl font-semibold text-[var(--app-text)]"
            />
          </dd>
        </div>
      </dl>
    </div>
  );
}
