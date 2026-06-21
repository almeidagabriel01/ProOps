"use client";

import React, { useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Check, FileText, Kanban, Wallet } from "lucide-react";
import { MonoGlassCard } from "./_shared/mono-glass-card";
import { Accent, SectionHeading } from "./_shared/section-heading";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type ModuleHighlight = {
  badgeLabel: string;
  title: string;
  description: string;
  bullets: string[];
  imageSrc: string;
  imageAlt: string;
  icon: React.ComponentType<{ className?: string }>;
};

const MODULES: ModuleHighlight[] = [
  {
    badgeLabel: "Financeiro",
    title: "Financeiro e carteiras em tempo real.",
    description:
      "Controle receitas e despesas, acompanhe saldos por carteira e execute transferências internas com visão consolidada da operação financeira.",
    bullets: [
      "Lançamentos com filtros por tipo, status e período",
      "Carteiras com ajuste de saldo e histórico detalhado",
      "Resumo financeiro com saldo total e indicadores rápidos",
    ],
    imageSrc: "/hero/proposal-module.jpeg",
    imageAlt: "Módulo financeiro com controle de receitas e despesas",
    icon: Wallet,
  },
  {
    badgeLabel: "CRM",
    title: "CRM visual para propostas e lançamentos.",
    description:
      "Acompanhe o funil em quadro kanban com colunas configuráveis para propostas e cobranças, atualizando status por arraste e com visão instantânea da carteira.",
    bullets: [
      "Quadro kanban para propostas e lançamentos",
      "Atualização de status com arraste entre colunas",
      "Organização de prioridades e atrasos em um único fluxo",
    ],
    imageSrc: "/hero/kanban-module.jpeg",
    imageAlt: "Quadro kanban para acompanhamento do funil comercial",
    icon: Kanban,
  },
  {
    badgeLabel: "Propostas & PDF",
    title: "Propostas comerciais com editor de PDF.",
    description:
      "Monte propostas com produtos, serviços, soluções e ambientes, personalize capa e seções e gere PDF com preview em tempo real para envio imediato.",
    bullets: [
      "Editor visual de capa, conteúdo e estilo",
      "Preview em tempo real com exportação em PDF",
      "Compartilhamento por link e rastreio do documento",
    ],
    imageSrc: "/hero/editPDF-module.jpeg",
    imageAlt: "Editor de PDF para propostas comerciais com preview em tempo real",
    icon: FileText,
  },
];

function DeviceFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <MonoGlassCard
      tilt
      spotlight
      maxTilt={4}
      className="shadow-dramatic rounded-2xl"
    >
      <div className="flex items-center gap-2 border-b border-black/10 px-4 py-3 dark:border-white/10">
        <span className="h-2.5 w-2.5 rounded-full bg-black/15 dark:bg-white/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-black/15 dark:bg-white/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-black/15 dark:bg-white/20" />
        <div className="ml-3 flex-1 truncate rounded-md border border-black/10 bg-black/[0.03] px-3 py-1 text-[11px] font-medium text-black/45 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/45">
          app.proops.com.br
        </div>
      </div>
      <div className="module-media overflow-hidden">
        <Image
          src={src}
          alt={alt}
          width={1920}
          height={944}
          className="h-auto w-full object-cover object-top"
        />
      </div>
    </MonoGlassCard>
  );
}

/**
 * Módulos — showcase com profundidade. Cada módulo aparece em moldura "device"
 * (chrome de navegador) com tilt/spotlight e parallax sutil no scroll; numeral
 * fantasma editorial atrás do texto. Recebe `id="showcase"` (âncora "Plataforma"
 * da navbar/footer) além do `id="modulos"` já existente.
 */
export function LandingModules() {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = containerRef.current;
      if (!section) return;

      gsap.utils.toArray<HTMLElement>(".gsap-fade-up").forEach((element) => {
        gsap.fromTo(
          element,
          { y: 32, opacity: 0, autoAlpha: 0 },
          {
            y: 0,
            opacity: 1,
            autoAlpha: 1,
            duration: 1.05,
            ease: "power3.out",
            scrollTrigger: {
              trigger: element,
              start: "top 92%",
              toggleActions: "play none none reverse",
              invalidateOnRefresh: true,
            },
          },
        );
      });

      // Parallax sutil na moldura — apenas com motion habilitado
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.utils.toArray<HTMLElement>(".module-media").forEach((media) => {
          gsap.fromTo(
            media,
            { yPercent: -5 },
            {
              yPercent: 5,
              ease: "none",
              scrollTrigger: {
                trigger: media,
                start: "top bottom",
                end: "bottom top",
                scrub: true,
                invalidateOnRefresh: true,
              },
            },
          );
        });
      });

      return () => mm.revert();
    },
    { scope: containerRef },
  );

  return (
    <section
      ref={containerRef}
      id="modulos"
      className="relative overflow-hidden border-y border-black/10 bg-white py-24 dark:border-white/10 dark:bg-neutral-950"
    >
      {/* âncora "Plataforma" (navbar/footer #showcase) */}
      <span id="showcase" aria-hidden className="absolute -top-24" />

      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="A plataforma por dentro"
          title={
            <>
              Três módulos, uma <Accent>operação</Accent> sem atrito
            </>
          }
          description="Financeiro, CRM e propostas compartilham a mesma base de dados — o que você lança em um já reflete nos outros, sem retrabalho."
          className="gsap-fade-up mb-20"
        />

        <div className="flex flex-col gap-24 lg:gap-32">
          {MODULES.map((module, index) => {
            const isReversed = index % 2 === 1;
            const Icon = module.icon;

            return (
              <div
                key={module.title}
                className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20"
              >
                <div
                  className={`relative ${isReversed ? "lg:order-2 lg:pl-6" : "lg:pr-6"}`}
                >
                  <span
                    aria-hidden
                    className="gsap-fade-up pointer-events-none absolute -left-2 -top-16 select-none text-[8rem] font-black leading-none text-black/[0.04] dark:text-white/[0.05] lg:text-[10rem]"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <div className="relative space-y-6">
                    <div className="gsap-fade-up inline-flex items-center gap-2 rounded-full border border-black/15 bg-black/[0.02] px-3.5 py-1.5 text-sm font-medium text-black dark:border-white/15 dark:bg-white/[0.04] dark:text-white">
                      <Icon className="h-4 w-4" />
                      Módulo {module.badgeLabel}
                    </div>

                    <h3 className="gsap-fade-up text-3xl font-bold leading-tight text-black dark:text-white md:text-4xl">
                      {module.title}
                    </h3>

                    <p className="gsap-fade-up text-lg leading-relaxed text-black/65 dark:text-white/70">
                      {module.description}
                    </p>

                    <ul className="gsap-fade-up space-y-3.5 pt-1">
                      {module.bullets.map((bullet) => (
                        <li
                          key={bullet}
                          className="flex items-start gap-3 text-black/80 dark:text-white/80"
                        >
                          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border border-black/15 bg-black/[0.03] dark:border-white/15 dark:bg-white/[0.06]">
                            <Check className="h-3 w-3 text-black dark:text-white" />
                          </span>
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className={`gsap-fade-up ${isReversed ? "lg:order-1" : ""}`}>
                  <DeviceFrame src={module.imageSrc} alt={module.imageAlt} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
