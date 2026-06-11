"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { ArrowRight, Cpu, Layers } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { MonoGlassCard } from "./_shared/mono-glass-card";
import { Accent, SectionHeading } from "./_shared/section-heading";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const NICHE_CARDS = [
  {
    icon: Cpu,
    eyebrow: "Pacote pronto",
    title: "Automação Residencial",
    description:
      "Gerencie projetos de automação com catálogo de produtos, sistemas por ambiente e propostas técnicas em PDF profissional.",
    href: "/automacao-residencial",
  },
  {
    icon: Layers,
    eyebrow: "Pacote pronto",
    title: "Decoração de Interiores",
    description:
      "Crie propostas com cálculo automático por m², largura ou altura. Catálogo de tecidos, persianas e papéis de parede integrado.",
    href: "/decoracao",
  },
];

/**
 * Nichos — dois cards imersivos e altos com motivo de ícone "watermark", borda
 * light-sweep no hover (beam) e tilt/spotlight via MonoGlassCard. Links de nicho
 * e o CTA "Fale com a gente" preservados.
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

      gsap.utils.toArray<HTMLElement>(".niche-card").forEach((card, i) => {
        gsap.fromTo(
          card,
          { y: 36, opacity: 0, autoAlpha: 0 },
          {
            y: 0,
            opacity: 1,
            autoAlpha: 1,
            duration: 0.9,
            delay: i * 0.12,
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
      className="bg-white px-6 py-28 dark:bg-neutral-950"
    >
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Especializado no seu segmento"
          title={
            <>
              Feito para o seu <Accent>nicho</Accent>
            </>
          }
          description="Estes pacotes já vêm prontos na ProOps. Atua em outro segmento? Adaptamos para o seu nicho."
          className="niches-heading mb-14"
        />

        <div className="grid gap-6 md:grid-cols-2">
          {NICHE_CARDS.map(({ icon: Icon, eyebrow, title, description, href }) => (
            <Link
              key={href}
              href={href}
              className="niche-card group block"
            >
              <MonoGlassCard
                beam
                maxTilt={4}
                className="min-h-[24rem] justify-between p-9"
              >
                <Icon
                  aria-hidden
                  className="pointer-events-none absolute -bottom-8 -right-6 h-52 w-52 text-black/[0.035] dark:text-white/[0.05]"
                />

                <div>
                  <div className="mb-7 flex h-16 w-16 items-center justify-center rounded-2xl border border-black/10 bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.06]">
                    <Icon className="h-8 w-8 text-black dark:text-white" />
                  </div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-black/50 dark:text-white/50">
                    {eyebrow}
                  </p>
                  <h3 className="mb-3 text-2xl font-bold text-black dark:text-white">
                    {title}
                  </h3>
                  <p className="max-w-md leading-relaxed text-black/60 dark:text-white/65">
                    {description}
                  </p>
                </div>

                <div className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-black dark:text-white">
                  Saiba mais
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" />
                </div>
              </MonoGlassCard>
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
