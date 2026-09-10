"use client";

import React from "react";
import gsap from "gsap";

import { LandingButton } from "@/components/landing/_shared/landing-button";
import { Realce } from "@/components/institucional/secao";
import { Magnetic } from "@/components/marketing/_shared/magnetic";
import { useScrollScene } from "@/components/marketing/_shared/use-scroll-scene";
import { APP_NAME } from "@/lib/site/app-brand";
import { SITE_URLS } from "@/lib/site/surfaces";

interface Produto {
  eyebrow: string;
  nome: string;
  promessa: React.ReactNode;
  descricao: string;
  capacidades: string[];
  cta: string;
  href: string;
}

const PRODUTOS: Produto[] = [
  {
    eyebrow: "Para a empresa",
    nome: "ProOps ERP",
    promessa: (
      <>
        Da proposta ao <Realce>pós-venda</Realce>, numa base só.
      </>
    ),
    descricao:
      "O sistema de quem vende projeto: monta a proposta, acompanha o cliente pelo funil e fecha o mês sem trocar de ferramenta.",
    capacidades: [
      "Propostas com PDF próprio",
      "CRM e funil de vendas",
      "Financeiro, carteiras e notas fiscais",
    ],
    cta: "Conhecer o ERP",
    href: SITE_URLS.erp,
  },
  {
    eyebrow: "Para a pessoa",
    nome: APP_NAME,
    promessa: (
      <>
        Você manda uma mensagem. A IA <Realce>organiza</Realce>.
      </>
    ),
    descricao:
      "Notas, lembretes e controle financeiro pessoal por linguagem natural, no WhatsApp ou dentro do aplicativo.",
    capacidades: [
      "Lançamento por texto ou áudio",
      "Quanto sobra até o fim do mês",
      "Cartões, faturas e metas",
    ],
    cta: "Conhecer o aplicativo",
    href: SITE_URLS.app,
  },
];

/**
 * The two products, one screen each.
 *
 * Above `md` the section pins and the scroll drives the track sideways, so
 * moving from one product to the other reads as a camera pan rather than as two
 * boxes on a page. The copy inside each panel counter-moves against the pan,
 * which is what stops the two screens from feeling like one flat image being
 * dragged past: the panel is the camera move, the copy is parallax inside it.
 *
 * Below `md` there is no pin: the same two panels stack and scroll, and get
 * their own arrival instead. The markup is identical in both cases, which is
 * what keeps the small-screen path from being a second implementation that rots.
 *
 * Only transforms are animated, so all of it stays on the compositor.
 */
export function InstitucionalProdutos() {
  const sectionRef = React.useRef<HTMLElement>(null);
  const trackRef = React.useRef<HTMLDivElement>(null);

  // Desktop: the pan, with the parallax and the progress rule on the SAME
  // timeline. A second ScrollTrigger measuring a pinned section would measure
  // against the pin spacer instead of the viewport, and drift from the pan.
  useScrollScene(sectionRef, () => {
    const track = trackRef.current;
    const secao = sectionRef.current;
    if (!track || !secao) return;

    const copias = gsap.utils.toArray<HTMLElement>(
      ".produto-copia",
      secao,
    );
    const regua = secao.querySelector<HTMLElement>(".produto-regua");

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: secao,
        start: "top top",
        // One extra viewport of scroll buys the pan. A function keeps it correct
        // after a resize, together with invalidateOnRefresh.
        end: () => `+=${window.innerHeight}`,
        pin: true,
        scrub: 0.6,
        invalidateOnRefresh: true,
      },
    });

    tl.to(track, { xPercent: -50 }, 0);
    // The outgoing panel's copy leads the pan, the incoming one trails it. Small
    // numbers on purpose: past about 12% it stops reading as depth and starts
    // reading as the text sliding independently of its own panel.
    tl.fromTo(copias[0], { xPercent: 0 }, { xPercent: -9 }, 0);
    tl.fromTo(copias[1], { xPercent: 9 }, { xPercent: 0 }, 0);
    if (regua) tl.fromTo(regua, { scaleX: 0 }, { scaleX: 1 }, 0);

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
      gsap.set([track, ...copias, regua].filter(Boolean), {
        clearProps: "all",
      });
    };
  });

  // Below `md` the panels stack, so they arrive instead of panning.
  useScrollScene(
    sectionRef,
    () => {
      const copias = gsap.utils.toArray<HTMLElement>(
        ".produto-copia",
        sectionRef.current,
      );
      const tweens = copias.map((copia) =>
        gsap.fromTo(
          copia,
          { y: 30, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            ease: "expo.out",
            scrollTrigger: {
              trigger: copia,
              start: "top 80%",
              once: true,
            },
          },
        ),
      );
      return () => {
        tweens.forEach((t) => {
          t.scrollTrigger?.kill();
          t.kill();
        });
      };
    },
    {
      query:
        "(max-width: 767px) and (prefers-reduced-motion: no-preference)",
    },
  );

  return (
    <section
      ref={sectionRef}
      id="produtos"
      aria-label="Produtos da ProOps"
      className="relative md:h-[100svh] md:overflow-hidden"
    >
      <div ref={trackRef} className="flex flex-col md:w-[200vw] md:flex-row">
        {PRODUTOS.map((produto, index) => {
          const claro = index === 0;
          return (
            <article
              key={produto.nome}
              className={
                claro
                  ? "flex min-h-[100svh] w-full flex-col justify-center bg-white px-6 py-24 text-black md:w-screen md:px-16 lg:px-24"
                  : "flex min-h-[100svh] w-full flex-col justify-center bg-neutral-950 px-6 py-24 text-white md:w-screen md:px-16 lg:px-24"
              }
            >
              <div className="produto-copia mx-auto w-full max-w-2xl">
                <div className="mb-6 flex items-center justify-between gap-6">
                  <p
                    className={`inline-flex items-center gap-2.5 [font-family:var(--font-geist-mono)] text-[11px] font-medium uppercase tracking-[0.28em] ${
                      claro ? "text-black/45" : "text-[#6DDC9E]"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`h-px w-7 ${
                        claro ? "bg-black/30" : "bg-[#6DDC9E]/50"
                      }`}
                    />
                    {produto.eyebrow}
                  </p>
                  {/* Where the reader is in the pan. A horizontal scroll hides
                      its own length, and this is the only thing that says the
                      section has two screens rather than one. */}
                  <p
                    aria-hidden="true"
                    className={`[font-family:var(--font-geist-mono)] text-[11px] tabular-nums ${
                      claro ? "text-black/30" : "text-white/30"
                    }`}
                  >
                    0{index + 1} / 0{PRODUTOS.length}
                  </p>
                </div>

                <h2 className="[font-family:var(--font-bricolage)] text-sm font-bold uppercase tracking-[0.2em]">
                  {produto.nome}
                </h2>

                <p className="mt-5 [font-family:var(--font-bricolage)] text-3xl font-semibold leading-[1.12] tracking-tight md:text-5xl">
                  {produto.promessa}
                </p>

                <p
                  className={`mt-6 max-w-xl text-base leading-relaxed md:text-lg ${
                    claro ? "text-black/60" : "text-white/60"
                  }`}
                >
                  {produto.descricao}
                </p>

                <ul className="mt-9 space-y-3">
                  {produto.capacidades.map((capacidade) => (
                    <li
                      key={capacidade}
                      className={`flex items-baseline gap-3 text-sm md:text-base ${
                        claro ? "text-black/75" : "text-white/75"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-[0.45em] h-1 w-1 shrink-0 rounded-full ${
                          claro ? "bg-black/40" : "bg-[#6DDC9E]"
                        }`}
                      />
                      {capacidade}
                    </li>
                  ))}
                </ul>

                <div className="mt-11">
                  <Magnetic>
                    <LandingButton
                      href={produto.href}
                      external
                      variant={claro ? "onLight" : "inverted"}
                      size="lg"
                    >
                      {produto.cta}
                    </LandingButton>
                  </Magnetic>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/*
        The pan's travel. Desktop only, because below `md` the panels stack and
        the browser's own scrollbar already says how long the section is.

        `mix-blend-difference` because the rule is pinned while the panels pan
        UNDER it: it crosses a white screen and a near-black one, and a single
        colour is invisible on one of the two. Difference against white renders
        black on white and white on black, which is the one thing that reads on
        both without a second element.

        No `scale-x-0` in the class: the resting state in the markup has to be
        the FINAL one, so that under `prefers-reduced-motion`, where no timeline
        is created, the rule is drawn rather than absent. The `fromTo` sets the
        zero itself when the scrub starts.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-16 bottom-10 hidden h-px bg-white/25 mix-blend-difference md:block lg:inset-x-24"
      >
        <div className="produto-regua h-px w-full origin-left bg-white" />
      </div>
    </section>
  );
}
