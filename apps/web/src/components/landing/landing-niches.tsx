"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { ArrowRight, Cpu, Layers } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Accent, SectionHeading } from "./_shared/section-heading";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/** Motif "automação": grade de pontos + linhas de circuito com pulso de luz. */
function AutomationMotif() {
  const LINES = ["M6 26 H34 V58 H62", "M94 18 H66 V44 H50", "M50 92 V60 H78 V40"];
  const NODES: Array<[number, number]> = [
    [34, 58],
    [66, 44],
    [50, 60],
    [78, 40],
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 [background-image:radial-gradient(circle,rgba(0,0,0,0.18)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_50%_45%,black,transparent_78%)] dark:[background-image:radial-gradient(circle,rgba(255,255,255,0.18)_1px,transparent_1px)]" />
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        {LINES.map((d, i) => (
          <g key={d}>
            <path
              d={d}
              fill="none"
              strokeWidth={0.5}
              className="stroke-black/15 dark:stroke-white/15"
            />
            <path
              d={d}
              fill="none"
              pathLength={100}
              strokeDasharray="14 86"
              strokeWidth={0.9}
              strokeLinecap="round"
              className="animate-flow stroke-black/50 dark:stroke-white/75"
              style={{ animationDelay: `${i * 0.6}s` }}
            />
          </g>
        ))}
        {NODES.map(([x, y]) => (
          <circle
            key={`${x}-${y}`}
            cx={x}
            cy={y}
            r={1.3}
            className="fill-black/40 dark:fill-white/55"
          />
        ))}
      </svg>
    </div>
  );
}

/** Motif "decoração": ondas horizontais fluindo (drapeado de tecido). */
function DecorationMotif() {
  const Y = [22, 38, 54, 70, 86];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg
        viewBox="0 0 200 100"
        preserveAspectRatio="none"
        className="animate-marquee-x absolute inset-0 h-full w-[200%]"
      >
        {Y.map((y, i) => (
          <path
            key={y}
            d={`M0 ${y} Q25 ${y - 9} 50 ${y} T100 ${y} T150 ${y} T200 ${y}`}
            fill="none"
            strokeWidth={0.7}
            className="stroke-black/16 dark:stroke-white/18"
            style={{ opacity: 1 - i * 0.12 }}
          />
        ))}
      </svg>
    </div>
  );
}

type Niche = {
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  description: string;
  features: string[];
  href: string;
  motif: "automation" | "decoration";
};

const NICHES: Niche[] = [
  {
    icon: Cpu,
    eyebrow: "Pacote pronto",
    title: "Automação Residencial",
    description:
      "Gerencie projetos de automação com catálogo de produtos, sistemas por ambiente e propostas técnicas em PDF profissional.",
    features: ["Catálogo de produtos", "Sistemas por ambiente", "PDF técnico"],
    href: "/automacao-residencial",
    motif: "automation",
  },
  {
    icon: Layers,
    eyebrow: "Pacote pronto",
    title: "Decoração de Interiores",
    description:
      "Crie propostas com cálculo automático por m², largura ou altura. Catálogo de tecidos, persianas e papéis de parede integrado.",
    features: ["Cálculo por medidas", "Tecidos e persianas", "Orçamento automático"],
    href: "/decoracao",
    motif: "decoration",
  },
];

/**
 * Nichos — dois cards "pacote pronto" totalmente legíveis (sem conteúdo escondido
 * no hover). Cada card abre com uma janela de preview emoldurada onde vive um motif
 * monocromático animado próprio (automação = circuito com pulsos; decoração =
 * ondas/drapeado fluindo), seguida de ícone, título, descrição sempre visível e
 * chips de recursos. Reveal coreografado por card (entrada → wipe do preview →
 * stagger dos chips) com guarda de prefers-reduced-motion. Links de nicho e CTA
 * "Fale com a gente" preservados.
 */
export function LandingNiches() {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = containerRef.current;
      if (!section) return;

      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        section.querySelectorAll<HTMLElement>(".niches-heading").forEach((el) => {
          gsap.fromTo(
            el,
            { y: 22, opacity: 0, autoAlpha: 0 },
            {
              y: 0,
              opacity: 1,
              autoAlpha: 1,
              ease: "none",
              scrollTrigger: {
                trigger: el,
                start: "top 94%",
                end: "top 68%",
                scrub: true,
                invalidateOnRefresh: true,
              },
            },
          );
        });

        gsap.utils.toArray<HTMLElement>(".niche-panel").forEach((card, i) => {
          const preview = card.querySelector<HTMLElement>(".niche-preview");
          const features = card.querySelectorAll<HTMLElement>(".niche-feature");

          const tl = gsap.timeline({
            delay: i * 0.1,
            scrollTrigger: {
              trigger: card,
              start: "top 88%",
              invalidateOnRefresh: true,
            },
          });

          tl.fromTo(
            card,
            { y: 42, autoAlpha: 0 },
            { y: 0, autoAlpha: 1, duration: 0.85, ease: "power3.out" },
          );

          if (preview) {
            tl.fromTo(
              preview,
              { clipPath: "inset(0 0 100% 0)" },
              { clipPath: "inset(0 0 0% 0)", duration: 0.7, ease: "power2.out" },
              "-=0.55",
            );
          }

          if (features.length) {
            tl.fromTo(
              features,
              { y: 12, autoAlpha: 0 },
              {
                y: 0,
                autoAlpha: 1,
                duration: 0.5,
                stagger: 0.07,
                ease: "power2.out",
              },
              "-=0.35",
            );
          }
        });
      });

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(
          [".niches-heading", ".niche-panel", ".niche-preview", ".niche-feature"],
          { autoAlpha: 1, opacity: 1, y: 0, clipPath: "none" },
        );
      });

      return () => mm.revert();
    },
    { scope: containerRef },
  );

  return (
    <section
      ref={containerRef}
      className="border-t border-black/10 bg-white px-6 py-28 dark:border-white/10 dark:bg-neutral-950"
    >
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Especializado no seu segmento"
          title={
            <>
              Feito para o seu <Accent>nicho</Accent>
            </>
          }
          description="Estes pacotes já vêm prontos na ProOps, com catálogos e cálculos sob medida para cada operação. Atua em outro segmento? Adaptamos para o seu nicho."
          className="niches-heading mb-14"
        />

        <div className="grid gap-6 md:grid-cols-2">
          {NICHES.map(
            ({ icon: Icon, eyebrow, title, description, features, href, motif }, index) => (
              <Link
                key={href}
                href={href}
                aria-label={title}
                className="niche-panel group relative flex flex-col overflow-hidden rounded-3xl border border-black/10 bg-white transition-[border-color,box-shadow,transform] duration-500 ease-out hover:-translate-y-1 hover:border-black/20 hover:shadow-[0_30px_70px_-40px_rgba(0,0,0,0.45)] dark:border-white/10 dark:bg-neutral-900/40 dark:hover:border-white/25 dark:hover:shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)]"
              >
                {/* janela de preview emoldurada — o motif animado vira destaque */}
                <div className="niche-preview relative h-44 overflow-hidden border-b border-black/10 bg-gradient-to-b from-black/[0.04] to-transparent dark:border-white/10 dark:from-white/[0.05] md:h-52">
                  <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-[1.04]">
                    {motif === "automation" ? <AutomationMotif /> : <DecorationMotif />}
                  </div>

                  <div className="grain-overlay opacity-[0.04]" />

                  {/* numeral fantasma */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute right-5 top-2 select-none text-[5.5rem] font-black leading-none text-black/[0.05] dark:text-white/[0.06]"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  {/* ícone watermark grande */}
                  <Icon
                    aria-hidden
                    className="pointer-events-none absolute -bottom-7 -right-6 h-40 w-40 text-black/[0.05] transition-transform duration-700 group-hover:scale-110 dark:text-white/[0.07]"
                  />
                </div>

                {/* conteúdo sempre visível */}
                <div className="relative flex flex-1 flex-col p-7 md:p-8">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl border border-black/10 bg-white/70 backdrop-blur transition-colors duration-300 group-hover:border-black/20 dark:border-white/10 dark:bg-white/[0.06] dark:group-hover:border-white/25">
                      <Icon className="h-5 w-5 text-black dark:text-white" />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/50 dark:text-white/50">
                      {eyebrow}
                    </span>
                  </div>

                  <h3 className="mt-5 text-2xl font-bold text-black dark:text-white md:text-[1.7rem]">
                    {title}
                  </h3>

                  <p className="mt-3 leading-relaxed text-black/60 dark:text-white/65">
                    {description}
                  </p>

                  <ul className="mt-5 flex flex-wrap gap-2">
                    {features.map((feature) => (
                      <li
                        key={feature}
                        className="niche-feature inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-xs font-medium text-black/70 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/70"
                      >
                        <span className="h-1 w-1 rounded-full bg-black/40 dark:bg-white/45" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <span className="mt-auto inline-flex items-center gap-1.5 pt-7 text-sm font-semibold text-black dark:text-white">
                    Saiba mais
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" />
                  </span>
                </div>
              </Link>
            ),
          )}
        </div>

        <div className="mt-12 text-center">
          <p className="mb-3 text-sm text-black/60 dark:text-white/60">
            Atua em outro segmento? O ProOps adapta-se ao seu nicho.
          </p>
          <Link
            href="/contato"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-black transition-opacity hover:opacity-70 dark:text-white"
          >
            Fale com a gente
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
