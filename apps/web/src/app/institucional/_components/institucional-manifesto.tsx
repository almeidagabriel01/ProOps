"use client";

import React from "react";
import gsap from "gsap";

import { Accent } from "@/components/landing/_shared/section-heading";
import { useScrollScene } from "@/components/marketing/_shared/use-scroll-scene";

import { PRINCIPIOS } from "../_content/institucional-copy";
import { PlaceholderBadge } from "./placeholder-badge";

/**
 * How the company works, in three principles.
 *
 * The rows are authored in their final state and animated with `fromTo`, so
 * under reduced motion, on mobile, and before hydration they simply sit there,
 * readable. Only `y` and `opacity` move.
 */
export function InstitucionalManifesto() {
  const sectionRef = React.useRef<HTMLElement>(null);

  useScrollScene(sectionRef, () => {
    gsap.utils.toArray<HTMLElement>(".manifesto-row").forEach((row, index) => {
      gsap.fromTo(
        row,
        { y: 28, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          delay: index * 0.08,
          ease: "expo.out",
          scrollTrigger: { trigger: row, start: "top 88%", once: true },
        },
      );
    });
  });

  return (
    <section
      ref={sectionRef}
      id="como-pensamos"
      className="bg-neutral-950 px-6 py-28 text-white md:px-10 md:py-40"
    >
      <div className="mx-auto max-w-6xl">
        <PlaceholderBadge>revisar com o briefing</PlaceholderBadge>

        <p className="mb-4 inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">
          <span className="h-px w-7 bg-white/35" />
          Como pensamos
        </p>

        <h2 className="max-w-3xl [font-family:var(--font-bricolage)] text-3xl font-semibold leading-[1.12] tracking-tight md:text-5xl">
          Três coisas que decidem o que <Accent>entra</Accent> no produto.
        </h2>

        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:mt-20 md:grid-cols-3">
          {PRINCIPIOS.map((principio, index) => (
            <article
              key={principio.titulo}
              className="manifesto-row bg-neutral-950 p-8 md:p-10"
            >
              <span
                aria-hidden="true"
                className="[font-family:var(--font-bricolage)] text-sm font-bold tabular-nums text-white/25"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-5 [font-family:var(--font-bricolage)] text-xl font-semibold tracking-tight md:text-2xl">
                {principio.titulo}
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-white/55 md:text-base">
                {principio.texto}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
