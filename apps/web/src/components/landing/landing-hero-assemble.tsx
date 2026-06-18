"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowRight } from "lucide-react";
import { LandingButton } from "./_shared/landing-button";
import {
  HeroAppTopbar,
  HeroAppDock,
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
  { x: -0.24, y: -0.16, rotation: -7, scale: 0.9, speed: 0.9 }, // fluxo de caixa → esquerda/cima
  { x: 0.12, y: -0.44, rotation: 4, scale: 0.9, speed: 1.1 }, // propostas (donut) → topo central

  { x: 0.26, y: -0.12, rotation: 7, scale: 0.9, speed: 1.05 }, // clientes → direita/cima
  { x: -0.05, y: 0.32, rotation: -4, scale: 0.92, speed: 0.85 }, // últimas propostas → baixo central
];

const SCRUB = 0.4;
const END = "+=90%";

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
      const statics = gsap.utils.toArray<HTMLElement>("[data-hero-static]", hero);
      const cards = gsap.utils.toArray<HTMLElement>("[data-hero-card]", hero);
      if (!copy || !dashboard || statics.length === 0 || cards.length === 0) return;

      // matchMedia faz o cleanup automático (revert) quando a condição muda
      // ou o componente desmonta — e respeita prefers-reduced-motion.
      const mm = gsap.matchMedia();

      mm.add(
        "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
        () => {
          // revela o container escondido pelo CSS (md:motion-safe:invisible);
          // os fromTo abaixo aplicam o estado espalhado neste mesmo tick
          // (immediateRender), então não há frame com a dashboard montada
          gsap.set(dashboard, { visibility: "visible" });

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
          // 0.9 até o "fit scale" — 1.0, ou menos se a dashboard montada não
          // couber na altura da viewport (ex.: notebooks 1366x768). Sem
          // opacity: os cards espalhados vivem dentro dele e precisam estar
          // visíveis desde o início.
          tl.fromTo(
            dashboard,
            { scale: 0.9, y: 80 },
            {
              // 150px de folga = navbar flutuante + respiro vertical
              scale: () =>
                Math.min(1, (window.innerHeight - 150) / dashboard.offsetHeight),
              y: 0,
              duration: 0.9,
              ease: "power2.out",
            },
            0.1,
          );

          // ...enquanto o SHELL ESTÁTICO do app (janela, topbar, header do
          // dashboard e dock) faz o fade-in — o pano de fundo fixo que os
          // widgets voadores vêm completar, como no steep.app
          tl.fromTo(
            statics,
            { opacity: 0 },
            { opacity: 1, duration: 0.9, ease: "power2.out" },
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
      className="relative flex min-h-svh flex-col items-center justify-start overflow-hidden bg-white px-4 pb-16 pt-28 dark:bg-neutral-950 sm:px-6 md:justify-center md:motion-safe:h-svh md:motion-safe:pb-4 md:motion-safe:pt-24"
    >
      {/* glow decorativo de fundo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[42vh] w-[120vw] -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,rgba(0,0,0,0.05),transparent_65%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.06),transparent_65%)] md:h-[60vh]"
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
          <LandingButton
            href={HERO_COPY.primaryCta.href}
            variant="solid"
            size="md"
            trailingIcon={<ArrowRight className="h-4 w-4" />}
          >
            {HERO_COPY.primaryCta.label}
          </LandingButton>
          <LandingButton
            href={HERO_COPY.secondaryCta.href}
            variant="outline"
            size="md"
          >
            {HERO_COPY.secondaryCta.label}
          </LandingButton>
        </div>
      </div>

      {/* ── Dashboard montada (estado FINAL no DOM) ─────────────────────────
           Os cards já vivem nas posições do grid; o GSAP só os "espalha" no
           estado inicial via fromTo. Sem JS / com reduced-motion, a dashboard
           aparece montada — zero layout shift e encaixe pixel-perfect. */}
      {/* dashboard demo é decorativa: sem interação (links/tooltips).
           Estrutura em camadas, como no steep.app:
           - [data-hero-static] = shell do app (janela, topbar, header do
             dashboard, dock) — fica fixo e só faz fade-in
           - [data-hero-card]   = widgets que voam até encaixar no shell */}
      {/* md:motion-safe:invisible evita o "flash" da dashboard montada no
           primeiro paint (SSR) — o GSAP revela no mesmo tick em que aplica o
           estado espalhado. Mobile/reduced-motion nunca escondem. */}
      <div
        data-hero-dashboard
        aria-hidden="true"
        className="pointer-events-none relative z-10 mx-auto mt-8 w-full max-w-7xl select-none will-change-transform md:motion-safe:mt-0 md:motion-safe:invisible"
      >
        {/* superfície da janela do app */}
        <div
          data-hero-static
          className="absolute inset-0 rounded-[1.75rem] border border-border/60 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.05),0_24px_60px_-20px_rgba(0,0,0,0.25)]"
        />

        {/* topbar do app (estático) */}
        <div data-hero-static className="relative">
          <HeroAppTopbar />
        </div>

        {/* conteúdo do dashboard (pb menor: o dock flutua SOBRE o conteúdo,
             como no app real) */}
        <div className="relative px-4 pb-10 pt-4 sm:px-6 sm:pb-12">
          {/* header do dashboard (estático) */}
          <div data-hero-static>
            <HeroDashboardHeader />
          </div>

          {/* widgets que voam e se encaixam (3 colunas em cima + lista
               full-width embaixo: dashboard mais LARGA e mais baixa) */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-12 sm:gap-4">
            <div data-hero-card className="will-change-transform transform-gpu sm:col-span-5">
              <HeroCashFlowCard />
            </div>
            {/* mobile compacto: só o card de Fluxo de Caixa; demais voltam no desktop (md+) */}
            <div data-hero-card className="hidden transform-gpu will-change-transform sm:col-span-4 md:block">
              <HeroProposalStats />
            </div>
            <div data-hero-card className="hidden transform-gpu will-change-transform sm:col-span-3 md:block">
              <HeroClientsStats />
            </div>
            <div data-hero-card className="hidden transform-gpu will-change-transform sm:col-span-12 md:block">
              <HeroRecentProposals />
            </div>
          </div>
        </div>

        {/* dock de navegação flutuante (estático), como no app real */}
        <div
          data-hero-static
          className="absolute bottom-3 left-1/2 hidden -translate-x-1/2 sm:flex"
        >
          <HeroAppDock />
        </div>
      </div>
    </section>
  );
}
