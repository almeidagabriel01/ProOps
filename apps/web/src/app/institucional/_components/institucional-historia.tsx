"use client";

import React from "react";
import gsap from "gsap";

import { useScrollScene } from "@/components/marketing/_shared/use-scroll-scene";

import { MARCOS } from "../_content/institucional-copy";
import { PlaceholderBadge } from "@/components/institucional/placeholder-badge";

/**
 * The company timeline, read sideways.
 *
 * A timeline is the one thing a horizontal track is genuinely better at: time
 * runs left to right, so the scroll gesture and the content agree. Above `md`
 * the section pins and the scroll drags the track; below it, the same cards
 * become a normal vertical list, which is also what someone on reduced motion
 * gets.
 *
 * The distance is measured from the track rather than hardcoded, so adding a
 * fifth milestone lengthens the scroll on its own instead of cutting the last
 * card off.
 */
export function InstitucionalHistoria() {
  const sectionRef = React.useRef<HTMLElement>(null);
  const trackRef = React.useRef<HTMLDivElement>(null);

  useScrollScene(sectionRef, () => {
    const track = trackRef.current;
    if (!track) return;

    const distance = () => Math.max(track.scrollWidth - window.innerWidth, 0);

    gsap.to(track, {
      x: () => -distance(),
      ease: "none",
      scrollTrigger: {
        trigger: sectionRef.current,
        start: "top top",
        end: () => `+=${distance()}`,
        pin: true,
        scrub: 0.6,
        invalidateOnRefresh: true,
      },
    });
  });

  return (
    <section
      ref={sectionRef}
      id="historia"
      className="overflow-hidden bg-white px-6 py-28 text-black md:px-0 md:py-0"
    >
      <div className="md:flex md:h-[100svh] md:flex-col md:justify-center">
        <div className="md:px-16 lg:px-24">
          <div className="mx-auto max-w-6xl md:mx-0">
            <PlaceholderBadge>marcos e datas a definir</PlaceholderBadge>

            <p className="mb-4 inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-black/45">
              <span className="h-px w-7 bg-black/30" />
              Nossa história
            </p>

            <h2 className="[font-family:var(--font-bricolage)] text-3xl font-semibold leading-[1.12] tracking-tight md:text-5xl">
              Como a ProOps chegou até aqui.
            </h2>
          </div>
        </div>

        <div
          ref={trackRef}
          className="mt-12 flex flex-col gap-6 md:mt-16 md:w-max md:flex-row md:gap-0 md:pl-16 md:pr-[30vw] lg:pl-24"
        >
          {MARCOS.map((marco) => (
            <article
              key={marco.titulo}
              className="relative shrink-0 border-l border-black/15 pl-6 md:w-[26rem] md:border-l md:pl-8 md:pr-8"
            >
              <span
                aria-hidden="true"
                className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-black"
              />
              <p className="[font-family:var(--font-bricolage)] text-4xl font-extrabold tabular-nums tracking-tight text-black/85 md:text-6xl">
                {marco.ano}
              </p>
              <h3 className="mt-4 [font-family:var(--font-bricolage)] text-lg font-semibold tracking-tight md:text-xl">
                {marco.titulo}
              </h3>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-black/55 md:text-base">
                {marco.texto}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
