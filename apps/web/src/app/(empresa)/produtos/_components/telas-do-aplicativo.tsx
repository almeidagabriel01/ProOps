"use client";

import React, { useRef } from "react";
import Image from "next/image";
import { m as motion, useTransform } from "motion/react";

import { DeviceFrame } from "@/components/marketing/_shared/device-frame";
import { useScrollProgress } from "@/components/marketing/_shared/use-scroll-progress";
import { APP_NAME } from "@/lib/site/app-brand";

interface Tela {
  arquivo: string;
  rotulo: string;
  legenda: string;
}

/**
 * Real captures from `public/mockup-ios`, the same files the app landing uses.
 *
 * Three and not six: this is the company site introducing a product, not the
 * product's own landing selling it. Whoever wants the full tour has a link.
 */
const TELAS: Tela[] = [
  {
    arquivo: "/mockup-ios/hoje.jpg",
    rotulo: "Hoje",
    legenda: "Quanto sobra até o fim do mês, já contando o que está comprometido.",
  },
  {
    arquivo: "/mockup-ios/financeiro.jpg",
    rotulo: "Financeiro",
    legenda: "Cartões, faturas e metas, alimentados pelo que você mandou por mensagem.",
  },
  {
    arquivo: "/mockup-ios/notas.jpg",
    rotulo: "Notas",
    legenda: "Uma frase ou um áudio, e a IA classifica sem você abrir categoria.",
  },
];

/**
 * Three phones, fanned, rising as the reader arrives.
 *
 * A row of three identical frames is a product shelf; offsetting them vertically
 * and letting the middle one lead turns the same three into a group. The offsets
 * are `md:` only, because at phone width they stack and any offset would just be
 * uneven spacing.
 *
 * `DeviceFrame` is the same component `/aplicativo` uses, moved to the shared
 * folder for this: two drawings of the same phone on one site drift, and here
 * they would sit two scrolls apart.
 */
export function TelasDoAplicativo() {
  const trilha = useRef<HTMLDivElement>(null);
  const { progress, animated } = useScrollProgress(trilha, {
    start: "top 85%",
    end: "bottom 70%",
    fallback: 1,
  });

  return (
    <div
      ref={trilha}
      className="grid gap-10 sm:grid-cols-3 sm:items-end sm:gap-6 lg:gap-10"
    >
      {TELAS.map((tela, index) => (
        <Aparelho
          key={tela.arquivo}
          tela={tela}
          indice={index}
          total={TELAS.length}
          progresso={progress}
          animado={animated}
        />
      ))}
    </div>
  );
}

/** How far each phone sits below the middle one. The centre leads. */
const DESNIVEL = ["md:translate-y-8", "", "md:translate-y-12"];

function Aparelho({
  tela,
  indice,
  total,
  progresso,
  animado,
}: {
  tela: Tela;
  indice: number;
  total: number;
  progresso: ReturnType<typeof useScrollProgress>["progress"];
  animado: boolean;
}) {
  // The middle one arrives first, then its neighbours, so the group assembles
  // outward from the centre instead of left to right like a list.
  const ordem = [1, 0, 2][indice] ?? indice;
  const fatia = 0.45 / total;
  const de = 0.05 + ordem * fatia;
  const ate = de + fatia * 2.6;

  const y = useTransform(progresso, [de, ate], [44, 0]);
  const opacity = useTransform(progresso, [de, ate], [0, 1]);

  return (
    <motion.figure
      style={animado ? { y, opacity } : undefined}
      className={DESNIVEL[indice]}
    >
      <div className="mx-auto w-full max-w-[15rem]">
        <DeviceFrame platform="ios">
          <Image
            src={tela.arquivo}
            alt={`Tela ${tela.rotulo} da ${APP_NAME}`}
            fill
            sizes="(min-width: 640px) 15rem, 70vw"
            className="object-cover"
          />
        </DeviceFrame>
      </div>
      <figcaption className="mx-auto mt-7 max-w-[15rem] text-center">
        <p className="[font-family:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.2em] text-white/40">
          {tela.rotulo}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-white/60">
          {tela.legenda}
        </p>
      </figcaption>
    </motion.figure>
  );
}
