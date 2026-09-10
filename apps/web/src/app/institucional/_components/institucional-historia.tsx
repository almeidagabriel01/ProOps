"use client";

import React from "react";
import gsap from "gsap";

import { PlaceholderBadge } from "@/components/institucional/placeholder-badge";
import { Realce, Sobrancelha } from "@/components/institucional/secao";
import { CurtainLink } from "@/components/marketing/_shared/curtain-transition";
import { Magnetic } from "@/components/marketing/_shared/magnetic";
import { useScrollScene } from "@/components/marketing/_shared/use-scroll-scene";

import { MARCOS } from "../_content/institucional-copy";

/**
 * Quanto scroll custa cada pixel de deslocamento do trilho.
 *
 * A largura do cartão importa tanto quanto este número: com o texto curto e
 * cartões estreitos os quatro marcos couberam na tela de uma vez, o trilho ficou
 * menor que o viewport, `distance()` foi a zero e o pin deixou de ter o que
 * fazer. Cartão largo é o que garante que só dois ou três apareçam por vez.
 *
 * Em 1 a linha do tempo passava rápido demais: quatro marcos numa tela e pouco,
 * e a leitura não acompanhava o gesto. Em 2.2 os mesmos marcos levam cerca de
 * duas telas e meia.
 */
const RITMO = 2.2;

/**
 * The company timeline, read sideways.
 *
 * A timeline is the one thing a horizontal track is genuinely better at: time
 * runs left to right, so the scroll gesture and the content agree. Above `md`
 * the section pins and the scroll drags the track; below it the same cards
 * become a normal vertical list, which is also what someone on reduced motion
 * gets.
 *
 * The distance is measured from the track rather than hardcoded, so adding a
 * fifth milestone lengthens the scroll on its own instead of cutting the last
 * card off.
 *
 * Three things ride on the same timeline as the drag, because a second
 * ScrollTrigger on a pinned section would measure against the pin spacer and
 * drift: the spine that draws itself under the cards, the dot that fills as its
 * card reaches the middle of the screen, and the progress rule.
 */
export function InstitucionalHistoria() {
  const sectionRef = React.useRef<HTMLElement>(null);
  const trackRef = React.useRef<HTMLDivElement>(null);

  useScrollScene(sectionRef, () => {
    const track = trackRef.current;
    const secao = sectionRef.current;
    if (!track || !secao) return;

    /**
     * How far the track travels sideways. The SCROLL it costs is that distance
     * times `RITMO`, below, which is what decides how slow the timeline reads.
     */
    const distance = () => Math.max(track.scrollWidth - window.innerWidth, 0);
    const espinha = secao.querySelector<HTMLElement>(".historia-espinha");
    const regua = secao.querySelector<HTMLElement>(".historia-regua");
    const pontos = gsap.utils.toArray<HTMLElement>(".historia-ponto", secao);

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: secao,
        start: "top top",
        // 2.2x the travel: one pixel of scroll moves the track less than a
        // pixel, so the four milestones take about two and a half screens to
        // pass instead of flicking by in one. Tied to the measured distance
        // rather than to a constant, so a fifth milestone slows it further on
        // its own instead of speeding the others up.
        end: () => `+=${distance() * RITMO}`,
        pin: true,
        scrub: 0.6,
        invalidateOnRefresh: true,
      },
    });

    tl.to(track, { x: () => -distance() }, 0);
    if (espinha) tl.fromTo(espinha, { scaleX: 0 }, { scaleX: 1 }, 0);
    if (regua) tl.fromTo(regua, { scaleX: 0 }, { scaleX: 1 }, 0);

    // Each dot fills as its own card crosses the middle. The window is derived
    // from the card count so a fifth milestone needs no new number here.
    pontos.forEach((ponto, index) => {
      const inicio = index / pontos.length;
      tl.fromTo(
        ponto,
        { scale: 0.25, opacity: 0.3 },
        { scale: 1, opacity: 1, duration: 0.5 / pontos.length },
        Math.max(inicio - 0.05, 0),
      );
    });

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
      gsap.set(
        [track, espinha, regua, ...pontos].filter(Boolean),
        { clearProps: "all" },
      );
    };
  });

  return (
    <section
      ref={sectionRef}
      id="historia"
      aria-label="A história da ProOps"
      className="relative overflow-hidden border-t border-black/10 bg-white px-6 py-28 text-black md:px-0 md:py-0"
    >
      <div
        aria-hidden="true"
        className="grade-pontos grade-pontos--claro pointer-events-none absolute inset-0 opacity-50"
      />

      <div className="relative z-10 md:flex md:h-[100svh] md:flex-col md:justify-center">
        <div className="md:px-16 lg:px-24">
          <div className="mx-auto max-w-6xl md:mx-0">
            <PlaceholderBadge>marcos e datas a definir</PlaceholderBadge>

            <Sobrancelha tom="claro" className="mb-5">
              Nossa história
            </Sobrancelha>

            <h2 className="[font-family:var(--font-bricolage)] text-3xl font-semibold leading-[1.12] tracking-tight md:text-5xl">
              Como a ProOps chegou <Realce>até aqui</Realce>.
            </h2>
          </div>
        </div>

        {/*
          The spine runs the full width of the TRACK, not of the viewport, so it
          is dragged along with the cards and draws itself as the timeline moves.
          `scaleX` from the left, never a width: width is layout, and layout
          animated inside a pin is guaranteed jitter.
        */}
        <div className="relative mt-12 md:mt-16">
          <div
            ref={trackRef}
            className="relative flex flex-col gap-6 md:w-max md:flex-row md:gap-0 md:pl-16 md:pr-[30vw] lg:pl-24"
          >
            <span
              aria-hidden="true"
              className="historia-espinha absolute left-0 top-[9px] hidden h-px w-full origin-left bg-black/15 md:block"
            />

            {MARCOS.map((marco) => (
              <article
                key={marco.titulo}
                className="relative shrink-0 border-l border-black/15 pl-6 md:w-[34rem] md:border-l-0 md:pl-0 md:pr-12 md:pt-0"
              >
                <span
                  aria-hidden="true"
                  className="historia-ponto absolute -left-[5px] top-1.5 block h-2.5 w-2.5 rounded-full bg-black md:left-0 md:top-1"
                />
                <p className="[font-family:var(--font-bricolage)] text-4xl font-extrabold tabular-nums tracking-tight text-black/85 md:mt-8 md:text-6xl">
                  {marco.ano}
                </p>
                <h3 className="mt-4 [font-family:var(--font-bricolage)] text-lg font-semibold tracking-tight md:text-xl">
                  {marco.titulo}
                </h3>
                {/* `resumo`, não `texto`: o relato é de /sobre. Aqui a linha do
                    tempo é uma passada, e quatro parágrafos num trilho
                    horizontal é leitura que o gesto não acompanha. */}
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-black/55 md:text-base">
                  {marco.resumo}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-12 md:mt-16 md:px-16 lg:px-24">
          <Magnetic>
            <CurtainLink
              href="/sobre"
              className="group inline-flex items-center gap-2 border-b border-black/25 pb-1.5 text-base text-black transition-colors hover:border-black"
            >
              A história com as datas
              <span
                aria-hidden="true"
                className="inline-block transition-transform duration-300 group-hover:translate-x-1"
              >
                &rarr;
              </span>
            </CurtainLink>
          </Magnetic>
        </div>
      </div>

      {/* Desktop only: below `md` the cards are a vertical list and the
          browser's own scrollbar already says how long the section is. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-16 bottom-10 hidden h-px bg-black/10 md:block lg:inset-x-24"
      >
        <div className="historia-regua h-px w-full origin-left bg-black/50" />
      </div>
    </section>
  );
}
