"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { Cpu, Layers, ArrowRight } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const NICHE_CARDS = [
  {
    icon: Cpu,
    eyebrow: "Para integradores",
    title: "Automação Residencial",
    description:
      "Gerencie projetos de automação com catálogo de produtos, sistemas por ambiente e propostas técnicas em PDF profissional.",
    href: "/automacao-residencial",
  },
  {
    icon: Layers,
    eyebrow: "Para lojas de decoração",
    title: "Decoração de Interiores",
    description:
      "Crie propostas com cálculo automático por m², largura ou altura. Catálogo de tecidos, persianas e papéis de parede integrado.",
    href: "/decoracao",
  },
];

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

      section.querySelectorAll<HTMLElement>(".niche-card").forEach((card, i) => {
        gsap.fromTo(
          card,
          { y: 32, opacity: 0, autoAlpha: 0 },
          {
            y: 0,
            opacity: 1,
            autoAlpha: 1,
            duration: 1.0,
            delay: i * 0.12,
            ease: "power3.out",
            scrollTrigger: {
              trigger: card,
              start: "top 94%",
              end: "bottom 50%",
              toggleActions: "play none none reverse",
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
      className="py-24 px-4 bg-white dark:bg-neutral-950"
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <p className="niches-heading text-xs font-semibold uppercase tracking-wider text-black/55 dark:text-white/55 mb-3">
            Especializado no seu segmento
          </p>
          <h2 className="niches-heading text-3xl font-bold tracking-tight text-black dark:text-white mb-3">
            Feito para o seu nicho
          </h2>
          <p className="niches-heading text-black/60 dark:text-white/60 max-w-xl mx-auto">
            O ProOps é especializado em dois segmentos. Escolha o que melhor descreve o seu negócio.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {NICHE_CARDS.map(({ icon: Icon, eyebrow, title, description, href }) => (
            <div key={href} className="niche-card relative rounded-2xl">
              <div className="card-border-beam" aria-hidden />
              <Link
                href={href}
                className="card-shine-on-hover group relative flex flex-col gap-5 rounded-2xl border border-black/10 bg-white p-8 transition-all duration-300 hover:-translate-y-1 hover:border-black/20 hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)] dark:border-white/10 dark:bg-neutral-900 dark:hover:border-white/20 dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.45)]"
              >
                <div className="relative h-14 w-14 grid place-items-center rounded-2xl border border-black/10 bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.05]">
                  <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.07)_0%,transparent_70%)] dark:bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_0%,transparent_70%)] animate-pulse-slow" />
                  <Icon className="relative h-7 w-7 text-black dark:text-white" />
                </div>

                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-black/55 dark:text-white/55 mb-1">
                    {eyebrow}
                  </p>
                  <h3 className="text-xl font-bold text-black dark:text-white mb-2">
                    {title}
                  </h3>
                  <p className="text-sm leading-relaxed text-black/60 dark:text-white/60">
                    {description}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 text-sm font-medium text-black dark:text-white">
                  Saiba mais
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
