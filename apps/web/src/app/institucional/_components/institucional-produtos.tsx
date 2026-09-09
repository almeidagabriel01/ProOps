"use client";

import React from "react";
import gsap from "gsap";

import { LandingButton } from "@/components/landing/_shared/landing-button";
import { Accent } from "@/components/landing/_shared/section-heading";
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
        Da proposta ao <Accent>pós-venda</Accent>, numa base só.
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
        Você manda uma mensagem. A IA <Accent>organiza</Accent>.
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
 * moving from one product to the other reads as a camera pan rather than as
 * two boxes on a page. Below `md`, and for anyone who asked for less movement,
 * there is no pin and no JavaScript: the same two panels simply stack and
 * scroll normally. The markup is identical in both cases, which is what keeps
 * the reduced-motion path from being a second implementation that rots.
 *
 * Only `x` is animated, so the work stays on the compositor.
 */
export function InstitucionalProdutos() {
  const sectionRef = React.useRef<HTMLElement>(null);
  const trackRef = React.useRef<HTMLDivElement>(null);

  useScrollScene(sectionRef, () => {
    const track = trackRef.current;
    if (!track) return;

    gsap.to(track, {
      xPercent: -50,
      ease: "none",
      scrollTrigger: {
        trigger: sectionRef.current,
        start: "top top",
        // One extra viewport of scroll buys the pan. A function keeps it
        // correct after a resize, together with invalidateOnRefresh.
        end: () => `+=${window.innerHeight}`,
        pin: true,
        scrub: 0.6,
        invalidateOnRefresh: true,
      },
    });
  });

  return (
    <section
      ref={sectionRef}
      id="produtos"
      aria-label="Produtos da ProOps"
      className="relative md:h-[100svh] md:overflow-hidden"
    >
      <div ref={trackRef} className="flex flex-col md:w-[200vw] md:flex-row">
        {PRODUTOS.map((produto, index) => (
          <article
            key={produto.nome}
            className={
              index === 0
                ? "flex min-h-[100svh] w-full flex-col justify-center bg-white px-6 py-24 text-black md:w-screen md:px-16 lg:px-24"
                : "flex min-h-[100svh] w-full flex-col justify-center bg-neutral-950 px-6 py-24 text-white md:w-screen md:px-16 lg:px-24"
            }
          >
            <div className="mx-auto w-full max-w-2xl">
              <p
                className={`mb-6 inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.28em] ${
                  index === 0 ? "text-black/45" : "text-[#6DDC9E]"
                }`}
              >
                <span
                  className={`h-px w-7 ${
                    index === 0 ? "bg-black/30" : "bg-[#6DDC9E]/50"
                  }`}
                />
                {produto.eyebrow}
              </p>

              <h2 className="[font-family:var(--font-bricolage)] text-sm font-bold uppercase tracking-[0.2em]">
                {produto.nome}
              </h2>

              <p className="mt-5 [font-family:var(--font-bricolage)] text-3xl font-semibold leading-[1.12] tracking-tight md:text-5xl">
                {produto.promessa}
              </p>

              <p
                className={`mt-6 max-w-xl text-base leading-relaxed md:text-lg ${
                  index === 0 ? "text-black/60" : "text-white/60"
                }`}
              >
                {produto.descricao}
              </p>

              <ul className="mt-9 space-y-3">
                {produto.capacidades.map((capacidade) => (
                  <li
                    key={capacidade}
                    className={`flex items-baseline gap-3 text-sm md:text-base ${
                      index === 0 ? "text-black/75" : "text-white/75"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-[0.45em] h-1 w-1 shrink-0 rounded-full ${
                        index === 0 ? "bg-black/40" : "bg-[#6DDC9E]"
                      }`}
                    />
                    {capacidade}
                  </li>
                ))}
              </ul>

              <div className="mt-11">
                <LandingButton
                  href={produto.href}
                  external
                  variant={index === 0 ? "onLight" : "inverted"}
                  size="lg"
                >
                  {produto.cta}
                </LandingButton>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
