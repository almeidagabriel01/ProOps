"use client";

import React, { useRef } from "react";
import Image from "next/image";
import { m as motion, useTransform } from "motion/react";

import { DeviceFrame } from "@/components/marketing/_shared/device-frame";
import { useMediaQuery } from "@/components/marketing/_shared/use-media-query";
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
    legenda:
      "Quanto sobra até o fim do mês, já contando o que está comprometido.",
  },
  {
    arquivo: "/mockup-ios/financeiro.jpg",
    rotulo: "Financeiro",
    legenda:
      "Cartões, faturas e metas, alimentados pelo que você mandou por mensagem.",
  },
  {
    arquivo: "/mockup-ios/notas.jpg",
    rotulo: "Notas",
    legenda:
      "Uma frase ou um áudio, e a IA classifica sem você abrir categoria.",
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
  // `sm`, and not `md`, because that is where the grid below goes to three
  // columns. The server snapshot is `false`, i.e. stacked, which is the safe
  // side: stacked is the path where each phone has its own clock.
  const lado = useMediaQuery("(min-width: 640px)");

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
          empilhado={!lado}
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
  empilhado,
}: {
  tela: Tela;
  indice: number;
  total: number;
  progresso: ReturnType<typeof useScrollProgress>["progress"];
  animado: boolean;
  empilhado: boolean;
}) {
  /*
    Empilhado, cada aparelho tem o próprio relógio.

    A cena foi escrita para a fileira de três, em que o grupo inteiro cabe numa
    tela e uma só trilha mede todos. Empilhada, a mesma trilha passa a ter três
    aparelhos de altura, perto de 1800px num celular, e as fatias dela viravam
    distância de rolagem: o primeiro aparelho só chegava a opacidade cheia com
    quase 60% dessa trilha percorrida, ou seja, depois de já ter passado pela
    tela inteira apagado. A ordem "do centro para fora" também não significa
    nada numa coluna.

    Aqui a entrada começa quando o topo do aparelho aparece e termina com ele a
    um terço da tela, que é onde o leitor está olhando.
  */
  const figura = useRef<HTMLElement>(null);
  const proprio = useScrollProgress(figura, {
    start: "top 95%",
    end: "top 60%",
    fallback: 1,
  }).progress;

  // The middle one arrives first, then its neighbours, so the group assembles
  // outward from the centre instead of left to right like a list.
  const ordem = [1, 0, 2][indice] ?? indice;
  const fatia = 0.45 / total;
  const de = 0.05 + ordem * fatia;
  const ate = de + fatia * 2.6;

  // Both pairs always exist and the style picks one: which motion value feeds a
  // `useTransform` is fixed at its first render, so switching the SOURCE when
  // the viewport crosses `sm` would keep reading the old one.
  const yGrupo = useTransform(progresso, [de, ate], [44, 0]);
  const opacityGrupo = useTransform(progresso, [de, ate], [0, 1]);
  const yProprio = useTransform(proprio, [0, 1], [44, 0]);
  const opacityProprio = useTransform(proprio, [0, 1], [0, 1]);
  const y = empilhado ? yProprio : yGrupo;
  const opacity = empilhado ? opacityProprio : opacityGrupo;

  return (
    <motion.figure
      ref={figura}
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
