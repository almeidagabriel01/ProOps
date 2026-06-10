"use client";

import React, { useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowRight } from "lucide-react";
import {
  HeroDashboardHeader,
  HeroCashFlowCard,
  HeroProposalStats,
  HeroClientsStats,
  HeroRecentProposals,
} from "./hero-dashboard-demo";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/* ────────────────────────────────────────────────────────────────────────────
   CONFIGURAÇÃO DA ANIMAÇÃO — AJUSTE AQUI

   - SCATTER: posição inicial de cada card "solto". x/y são frações da
     viewport (ex.: x: -0.55 = 55% da largura para a esquerda do encaixe
     final). rotation em graus, scale relativo, speed controla o parallax
     (maior = chega mais cedo na timeline).
   - A ordem do array segue a ordem dos cards no grid (data-hero-card).
   - SCRUB: suavização do atrelamento ao scroll (1 = ~1s de "catch-up").
   - END: distância de scroll que dirige a animação ("+=250%" = 2,5 alturas
     de viewport com a seção pinada).
──────────────────────────────────────────────────────────────────────────── */

interface ScatterConfig {
  x: number;
  y: number;
  rotation: number;
  scale: number;
  speed: number;
}

// Offsets calibrados para os cards ficarem ESPALHADOS MAS VISÍVEIS ao redor
// do título no load (o grid já os afasta do centro; o offset empurra cada um
// para a borda mais próxima sem sair totalmente da viewport)
const SCATTER: ScatterConfig[] = [
  { x: 0.0, y: -0.32, rotation: -4, scale: 0.92, speed: 1.0 }, // header → topo central
  { x: -0.27, y: -0.16, rotation: -7, scale: 0.9, speed: 0.9 }, // fluxo de caixa → esquerda/cima
  { x: 0.25, y: -0.12, rotation: 7, scale: 0.9, speed: 1.1 }, // propostas (donut) → direita/cima
  { x: -0.24, y: 0.2, rotation: -6, scale: 0.9, speed: 1.05 }, // clientes → canto inf. esquerdo
  { x: 0.2, y: 0.22, rotation: 6, scale: 0.92, speed: 0.85 }, // últimas propostas → inf. direito
];

const SCRUB = 0.8;
const END = "+=150%";

/* AJUSTE: textos e CTAs do hero */
const HERO_COPY = {
  badge: "Gestão completa para o seu negócio",
  title: "Tudo que sua operação precisa, em um só lugar",
  subtitle:
    "Propostas, CRM, financeiro e equipe — conectados em uma plataforma que monta o quadro completo do seu negócio.",
  primaryCta: { label: "Começar grátis", href: "/register" },
  secondaryCta: { label: "Ver planos", href: "#pricing" },
};

/* ────────────────────────────────────────────────────────────────────────────
   HERO — seção pinada onde os cards convergem formando a dashboard
──────────────────────────────────────────────────────────────────────────── */

export function LandingHeroAssemble() {
  const heroRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const hero = heroRef.current;
      if (!hero) return;

      const copy = hero.querySelector<HTMLElement>("[data-hero-copy]");
      const dashboard = hero.querySelector<HTMLElement>("[data-hero-dashboard]");
      const frame = hero.querySelector<HTMLElement>("[data-hero-frame]");
      const cards = gsap.utils.toArray<HTMLElement>("[data-hero-card]", hero);
      if (!copy || !dashboard || !frame || cards.length === 0) return;

      // matchMedia faz o cleanup automático (revert) quando a condição muda
      // ou o componente desmonta — e respeita prefers-reduced-motion.
      const mm = gsap.matchMedia();

      mm.add(
        "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
        () => {
          const tl = gsap.timeline({
            defaults: { ease: "power3.out" },
            scrollTrigger: {
              trigger: hero,
              // pin: segura a seção na tela enquanto o usuário rola — a
              // animação acontece "no lugar", como no steep.app
              pin: true,
              // scrub: 1 atrela o progresso da timeline à posição do scroll
              // com ~1s de suavização (reversível por natureza: rolar para
              // cima desfaz a animação)
              scrub: SCRUB,
              // start "top top": pina assim que o topo do hero toca o topo
              // da viewport (o hero é a primeira dobra, então pina já)
              start: "top top",
              // end "+=250%": são necessárias 2,5 alturas de viewport de
              // scroll para completar a montagem — distância confortável
              // para a convergência não parecer apressada
              end: END,
              // recalcula os offsets (funções abaixo) em resize/refresh
              invalidateOnRefresh: true,
            },
          });

          // Passo 1 (0 → 0.35): o bloco de título sai de cena para a
          // dashboard assumir o centro
          tl.to(
            copy,
            { opacity: 0, y: -60, scale: 0.96, duration: 0.35, ease: "power2.in" },
            0,
          );

          // Passo 2 (0.1 → 1): o container da dashboard sobe e cresce de
          // 0.9 → 1 (sem opacity — os cards espalhados vivem dentro dele e
          // precisam estar visíveis desde o início)...
          tl.fromTo(
            dashboard,
            { scale: 0.9, y: 80 },
            { scale: 1, y: 0, duration: 0.9, ease: "power2.out" },
            0.1,
          );

          // ...enquanto a "moldura" de fundo da dashboard faz o fade-in de
          // {opacity: 0, scale: 0.8} → {opacity: 1, scale: 1}, materializando
          // o palco onde os cards se encaixam
          tl.fromTo(
            frame,
            { opacity: 0, scale: 0.8 },
            { opacity: 1, scale: 1, duration: 0.9, ease: "power2.out" },
            0.1,
          );

          // Passo 3 (paralelo): cada card viaja da posição espalhada até o
          // encaixe (x/y/rotation/scale zerados). `speed` diferente por card
          // cria o parallax: durações distintas, todos terminando montados.
          cards.forEach((card, i) => {
            const cfg = SCATTER[i % SCATTER.length];
            tl.fromTo(
              card,
              {
                // offsets como função + invalidateOnRefresh: recalcula em
                // qualquer largura de viewport sem estourar a tela
                x: () => window.innerWidth * cfg.x,
                y: () => window.innerHeight * cfg.y,
                rotation: cfg.rotation,
                scale: cfg.scale,
              },
              {
                x: 0,
                y: 0,
                rotation: 0,
                scale: 1,
                duration: 0.85 / cfg.speed,
                ease: "power3.out",
              },
              // pequeno stagger de entrada reforça o efeito orgânico
              0.1 + i * 0.04,
            );
          });
        },
      );

      // Mobile (<768px) sem reduced-motion: nada de pin — só um fade-in
      // único e leve da dashboard quando ela entra na viewport.
      mm.add(
        "(max-width: 767px) and (prefers-reduced-motion: no-preference)",
        () => {
          gsap.from(dashboard, {
            opacity: 0,
            y: 40,
            duration: 0.7,
            ease: "power2.out",
            scrollTrigger: { trigger: dashboard, start: "top 85%", once: true },
          });
        },
      );

      // prefers-reduced-motion: reduce → nenhuma animação; o DOM já está no
      // estado final (dashboard montada), então não registramos nada.
    },
    { scope: heroRef },
  );

  return (
    <section
      ref={heroRef}
      id="hero"
      // h-svh no desktop (seção pinada ocupa a dobra); no mobile a seção
      // cresce com o conteúdo (título + dashboard empilhados)
      // as variantes md:motion-safe: só valem no desktop COM animação (seção
      // pinada de 1 dobra, copy absoluto sobre a dashboard); com
      // prefers-reduced-motion o layout fica empilhado (copy acima, dashboard
      // abaixo) e a página rola normalmente
      className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-white px-4 pb-16 pt-28 dark:bg-neutral-950 sm:px-6 md:motion-safe:h-svh md:motion-safe:pb-4 md:motion-safe:pt-24"
    >
      {/* glow decorativo de fundo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[60vh] w-[120vw] -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,rgba(0,0,0,0.05),transparent_65%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.06),transparent_65%)]"
      />

      {/* ── Título + subtítulo + CTAs (centro, sai de cena com o scroll) ── */}
      <div
        data-hero-copy
        className="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center will-change-transform md:motion-safe:absolute md:motion-safe:left-1/2 md:motion-safe:top-1/2 md:motion-safe:-translate-x-1/2 md:motion-safe:-translate-y-1/2 md:motion-safe:transform-gpu"
      >
        <span className="mb-5 inline-flex items-center rounded-full border border-black/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/55 dark:border-white/15 dark:text-white/50 [font-family:var(--font-pdf-inter)]">
          {HERO_COPY.badge}
        </span>
        <h1 className="text-4xl font-semibold leading-[1.08] tracking-[-0.03em] text-black dark:text-white sm:text-5xl md:text-6xl [font-family:var(--font-pdf-montserrat)]">
          {HERO_COPY.title}
        </h1>
        <p className="mt-5 max-w-xl text-base text-black/55 dark:text-white/55 sm:text-lg [font-family:var(--font-pdf-inter)]">
          {HERO_COPY.subtitle}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={HERO_COPY.primaryCta.href}
            className="group inline-flex items-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-100 sm:px-7 sm:py-3.5"
          >
            {HERO_COPY.primaryCta.label}
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
          <Link
            href={HERO_COPY.secondaryCta.href}
            className="inline-flex items-center gap-2 rounded-full border border-black/15 px-6 py-3 text-sm font-semibold text-black/60 transition-all duration-200 hover:border-black/30 hover:text-black dark:border-white/15 dark:text-white/50 dark:hover:border-white/30 dark:hover:text-white sm:px-7 sm:py-3.5"
          >
            {HERO_COPY.secondaryCta.label}
          </Link>
        </div>
      </div>

      {/* ── Dashboard montada (estado FINAL no DOM) ─────────────────────────
           Os cards já vivem nas posições do grid; o GSAP só os "espalha" no
           estado inicial via fromTo. Sem JS / com reduced-motion, a dashboard
           aparece montada — zero layout shift e encaixe pixel-perfect. */}
      {/* dashboard demo é decorativa: sem interação (links/tooltips) */}
      <div
        data-hero-dashboard
        aria-hidden="true"
        className="pointer-events-none relative z-10 mx-auto mt-12 grid w-full max-w-6xl select-none grid-cols-1 gap-3 will-change-transform sm:grid-cols-12 sm:gap-4 md:motion-safe:mt-0"
      >
        {/* moldura de fundo da dashboard — só ela faz o fade-in */}
        <div
          data-hero-frame
          aria-hidden="true"
          className="pointer-events-none absolute -inset-3 rounded-3xl border border-black/8 bg-black/[0.02] will-change-transform transform-gpu dark:border-white/10 dark:bg-white/[0.03] sm:-inset-5"
        />
        <div data-hero-card className="will-change-transform transform-gpu sm:col-span-12">
          <HeroDashboardHeader />
        </div>
        <div data-hero-card className="will-change-transform transform-gpu sm:col-span-7">
          <HeroCashFlowCard />
        </div>
        <div data-hero-card className="will-change-transform transform-gpu sm:col-span-5">
          <HeroProposalStats />
        </div>
        <div data-hero-card className="will-change-transform transform-gpu sm:col-span-5">
          <HeroClientsStats />
        </div>
        <div data-hero-card className="will-change-transform transform-gpu sm:col-span-7">
          <HeroRecentProposals />
        </div>
      </div>
    </section>
  );
}
