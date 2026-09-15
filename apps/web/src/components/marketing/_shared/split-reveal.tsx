"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { SplitText } from "gsap/dist/SplitText";

import { cn } from "@/lib/utils";
import { SCENE_ANY_WIDTH, useScrollScene } from "./use-scroll-scene";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText);
}

type Unit = "chars" | "words" | "lines";
type Mode = "rise" | "focus";

interface SplitRevealProps {
  children: React.ReactNode;
  /** What gets animated individually. `lines` reads best for a paragraph. */
  unit?: Unit;
  /**
   * `rise` plays once as the block enters, like a headline landing.
   * `focus` scrubs: the text sits dimmed and each unit lights up as the reader
   * scrolls through it, which is the effect that rewards a long pinned section.
   */
  mode?: Mode;
  /** Element rendered. A heading should pass its own tag. */
  as?: "h1" | "h2" | "h3" | "p" | "span" | "div";
  /** ScrollTrigger `start`. Defaults differ per mode. */
  start?: string;
  /** ScrollTrigger `end`. Only meaningful for `focus`. */
  end?: string;
  /** Seconds between units in `rise`. */
  stagger?: number;
  /** How dim an un-reached unit is in `focus`. */
  dim?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Kinetic type, authored in its final state.
 *
 * The text is rendered normally by the server and stays readable with no
 * JavaScript at all: `useScrollScene` only builds a timeline under
 * `prefers-reduced-motion: no-preference`, and `fromTo` means the resting state
 * on screen is the one in the markup. That is the difference between an effect
 * and a page that shows nothing until a bundle arrives.
 *
 * SplitText rewrites the DOM into per-unit spans, so it MUST be reverted on
 * cleanup: without that, crossing the media query or unmounting leaves the
 * shredded markup behind, and a second split shreds the shreds. The revert is
 * returned from the scene, which is exactly what `gsap.matchMedia` calls.
 *
 * `aria-label` is not needed: SplitText keeps the original text nodes inside
 * the spans, so the accessible name is unchanged. It does break text selection
 * across units, which is why `lines` is the default for body copy.
 */
export function SplitReveal({
  children,
  unit = "lines",
  mode = "rise",
  as: Tag = "p",
  start,
  end = "bottom 40%",
  stagger = 0.05,
  dim = 0.18,
  className,
  style,
}: SplitRevealProps) {
  const scope = useRef<HTMLElement>(null);

  useScrollScene(
    scope,
    () => {
      const el = scope.current;
      if (!el) return;

      const split = new SplitText(el, {
        type: unit,
        // Each unit gets a wrapper so `rise` can clip the movement without the
        // block growing, the same trick `.hero-rise-line` uses in CSS.
        mask: mode === "rise" ? unit : undefined,
        linesClass: "split-line",
        wordsClass: "split-word",
        charsClass: "split-char",
      });
      const parts = split[unit] as HTMLElement[];
      if (!parts.length) {
        split.revert();
        return;
      }

      /*
        O estado inicial é escrito AQUI, em todas as unidades, e não deixado por
        conta do `fromTo`.

        Com `stagger`, o render imediato do `fromTo` só alcança a primeira
        unidade: as outras ficam com o valor que já tinham, ou seja, visíveis e
        no lugar. Elas continuam lá, legíveis, até a sub-tween delas começar, e
        nesse instante saltam para `opacity: 0` deslocadas 110% para baixo antes
        de subir. O efeito na tela é um PISCA, a linha apaga e volta, que é o
        oposto exato do que a cena quer dizer, e é o que se via nas seções de
        fecho de /sobre e /manifesto, onde cada parágrafo tem duas linhas e
        portanto metade delas piscava.

        Medido no navegador: sem isto, com a página no topo e sem rolar, as
        linhas alternavam `opacity` 0 e 1 dentro do mesmo parágrafo.
      */
      const inicio =
        mode === "rise"
          ? { yPercent: 110, opacity: 0 }
          : { opacity: dim };
      gsap.set(parts, inicio);

      const tween =
        mode === "rise"
          ? gsap.fromTo(
              parts,
              inicio,
              {
                yPercent: 0,
                opacity: 1,
                duration: 0.9,
                ease: "expo.out",
                stagger,
                scrollTrigger: {
                  trigger: el,
                  start: start ?? "top 85%",
                  once: true,
                  invalidateOnRefresh: true,
                },
              },
            )
          : gsap.fromTo(
              parts,
              inicio,
              {
                opacity: 1,
                ease: "none",
                stagger: 1,
                scrollTrigger: {
                  trigger: el,
                  start: start ?? "top 75%",
                  end,
                  scrub: 0.6,
                  invalidateOnRefresh: true,
                },
              },
            );

      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
        split.revert();
      };
    },
    // Any width: kinetic type is the point of the page, and it costs nothing a
    // phone cannot afford. The motion preference is still honoured.
    { query: SCENE_ANY_WIDTH, dependencies: [unit, mode] },
  );

  return (
    <Tag
      ref={scope as React.RefObject<never>}
      className={cn(className)}
      style={style}
    >
      {children}
    </Tag>
  );
}
