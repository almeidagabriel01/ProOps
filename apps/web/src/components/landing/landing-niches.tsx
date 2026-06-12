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
      <div className="absolute inset-0 [background-image:radial-gradient(circle,rgba(0,0,0,0.16)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_55%_38%,black,transparent_72%)] dark:[background-image:radial-gradient(circle,rgba(255,255,255,0.16)_1px,transparent_1px)]" />
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
              className="animate-flow stroke-black/45 dark:stroke-white/70"
              style={{ animationDelay: `${i * 0.6}s` }}
            />
          </g>
        ))}
        {NODES.map(([x, y]) => (
          <circle
            key={`${x}-${y}`}
            cx={x}
            cy={y}
            r={1.2}
            className="fill-black/35 dark:fill-white/50"
          />
        ))}
      </svg>
    </div>
  );
}

/** Motif "decoração": ondas horizontais fluindo (drapeado de tecido). */
function DecorationMotif() {
  const Y = [26, 44, 62, 80];
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
            strokeWidth={0.6}
            className="stroke-black/14 dark:stroke-white/16"
            style={{ opacity: 1 - i * 0.14 }}
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
    href: "/automacao-residencial",
    motif: "automation",
  },
  {
    icon: Layers,
    eyebrow: "Pacote pronto",
    title: "Decoração de Interiores",
    description:
      "Crie propostas com cálculo automático por m², largura ou altura. Catálogo de tecidos, persianas e papéis de parede integrado.",
    href: "/decoracao",
    motif: "decoration",
  },
];

/**
 * Nichos — painéis interativos que expandem no hover (split expansível). Cada
 * nicho tem um motif monocromático animado próprio (automação = circuito com
 * pulsos; decoração = ondas/drapeado fluindo), grão e numeral fantasma. No mobile
 * empilham e ficam abertos. Links de nicho e CTA "Fale com a gente" preservados.
 */
export function LandingNiches() {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = containerRef.current;
      if (!section) return;

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
        gsap.fromTo(
          card,
          { y: 40, opacity: 0, autoAlpha: 0 },
          {
            y: 0,
            opacity: 1,
            autoAlpha: 1,
            duration: 0.9,
            delay: i * 0.14,
            ease: "power3.out",
            scrollTrigger: {
              trigger: card,
              start: "top 90%",
              invalidateOnRefresh: true,
            },
          },
        );
      });
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
          description="Estes pacotes já vêm prontos na ProOps. Passe o mouse para explorar — atua em outro segmento? Adaptamos para o seu nicho."
          className="niches-heading mb-14"
        />

        <div className="flex flex-col gap-5 md:h-[28rem] md:flex-row">
          {NICHES.map(({ icon: Icon, eyebrow, title, description, href, motif }, index) => (
            <Link
              key={href}
              href={href}
              aria-label={title}
              className="niche-panel group relative min-h-[20rem] basis-0 grow overflow-hidden rounded-3xl border border-black/10 bg-black/[0.015] transition-[flex-grow,border-color,box-shadow] duration-500 ease-out hover:border-black/20 dark:border-white/10 dark:bg-white/[0.025] dark:hover:border-white/25 md:min-h-0 md:hover:grow-[1.65] md:hover:shadow-[0_40px_80px_-40px_rgba(0,0,0,0.5)] md:dark:hover:shadow-[0_40px_90px_-40px_rgba(0,0,0,0.85)]"
            >
              {motif === "automation" ? <AutomationMotif /> : <DecorationMotif />}

              <div className="grain-overlay opacity-[0.05]" />

              {/* numeral fantasma */}
              <span
                aria-hidden
                className="pointer-events-none absolute right-6 top-2 select-none text-[7rem] font-black leading-none text-black/[0.04] dark:text-white/[0.05]"
              >
                {String(index + 1).padStart(2, "0")}
              </span>

              {/* ícone watermark grande */}
              <Icon
                aria-hidden
                className="pointer-events-none absolute -bottom-10 -right-8 h-56 w-56 text-black/[0.04] transition-transform duration-700 group-hover:scale-105 dark:text-white/[0.06]"
              />

              <div className="relative z-10 flex h-full flex-col p-8">
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl border border-black/10 bg-white/70 backdrop-blur transition-colors duration-300 group-hover:border-black/20 dark:border-white/10 dark:bg-white/[0.06] dark:group-hover:border-white/25">
                    <Icon className="h-6 w-6 text-black dark:text-white" />
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/50 dark:text-white/50">
                    {eyebrow}
                  </span>
                </div>

                <div className="mt-auto pt-10">
                  <h3 className="text-2xl font-bold text-black dark:text-white md:text-3xl">
                    {title}
                  </h3>
                  {/* descrição revela/expande no hover (desktop); sempre visível no mobile */}
                  <p className="mt-3 max-w-md leading-relaxed text-black/60 dark:text-white/65 md:max-h-0 md:-translate-y-1 md:overflow-hidden md:opacity-0 md:transition-all md:duration-500 md:group-hover:max-h-40 md:group-hover:translate-y-0 md:group-hover:opacity-100">
                    {description}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-black dark:text-white">
                    Saiba mais
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
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
