"use client";

import React, { useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { CheckCircle2, FileText, Kanban, Wallet } from "lucide-react";

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
    imageSrc: "/hero/generic-document-workflow.jpg",
    imageAlt: "Análise financeira com gráficos de desempenho e indicadores",
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
    imageSrc: "/hero/generic-team-analytics.jpg",
    imageAlt: "Equipe acompanhando evolução do pipeline comercial",
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
    imageSrc: "/hero/generic-strategy-meeting.jpg",
    imageAlt: "Reunião comercial para revisão de propostas e aprovações",
    icon: FileText,
  },
];

export function LandingModules() {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.utils.toArray(".gsap-fade-up").forEach((el: unknown) => {
        const element = el as Element;
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
              start: "top 94%",
              end: "bottom 50%",
              toggleActions: "play none none reverse",
              invalidateOnRefresh: true,
            },
          },
        );
      });

      gsap.utils.toArray(".gsap-media-right").forEach((el: unknown) => {
        const element = el as Element;
        gsap.fromTo(
          element,
          { x: 56, opacity: 0, autoAlpha: 0 },
          {
            x: 0,
            opacity: 1,
            autoAlpha: 1,
            duration: 1.1,
            ease: "power3.out",
            scrollTrigger: {
              trigger: element,
              start: "top 93%",
              end: "bottom 46%",
              toggleActions: "play none none reverse",
              invalidateOnRefresh: true,
            },
          },
        );
      });

      gsap.utils.toArray(".gsap-media-left").forEach((el: unknown) => {
        const element = el as Element;
        gsap.fromTo(
          element,
          { x: -56, opacity: 0, autoAlpha: 0 },
          {
            x: 0,
            opacity: 1,
            autoAlpha: 1,
            duration: 1.1,
            ease: "power3.out",
            scrollTrigger: {
              trigger: element,
              start: "top 93%",
              end: "bottom 46%",
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
      id="modulos"
      className="py-20 relative border-y border-black/10 dark:border-white/10 bg-white dark:bg-neutral-950"
    >
      <div className="max-w-7xl mx-auto px-6">
        {MODULES.map((module, index) => {
          const isReversed = index % 2 === 1;
          const Icon = module.icon;

          return (
            <div
              key={module.title}
              className={`flex flex-col items-center gap-14 py-16 ${
                isReversed ? "lg:flex-row-reverse" : "lg:flex-row"
              } ${index > 0 ? "border-t border-black/10 dark:border-white/10" : ""}`}
            >
              <div
                className={`w-full lg:w-1/2 space-y-7 ${
                  isReversed ? "lg:pl-8" : ""
                }`}
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-black/15 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.04] text-black dark:text-white text-sm font-medium gsap-fade-up">
                  <Icon className="w-4 h-4" />
                  Módulo {module.badgeLabel}
                </div>

                <h3 className="text-3xl md:text-5xl font-bold leading-tight text-black dark:text-white gsap-fade-up">
                  {module.title}
                </h3>

                <p className="text-black/65 dark:text-white/70 text-lg leading-relaxed gsap-fade-up">
                  {module.description}
                </p>

                <ul className="space-y-3 pt-2 gsap-fade-up">
                  {module.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="flex items-center gap-3 text-black/80 dark:text-white/80"
                    >
                      <CheckCircle2 className="w-5 h-5 text-black dark:text-white" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>

              <div
                className={`w-full lg:w-1/2 relative ${
                  isReversed ? "gsap-media-left" : "gsap-media-right"
                }`}
              >
                <div className="absolute -inset-10 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.07)_0,transparent_65%)] dark:bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08)_0,transparent_65%)] z-0" />
                <div className="relative rounded-2xl border border-black/15 dark:border-white/15 overflow-hidden bg-white dark:bg-neutral-900 z-10 shadow-[0_20px_50px_rgba(0,0,0,0.12)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                  <Image
                    src={module.imageSrc}
                    alt={module.imageAlt}
                    width={1920}
                    height={944}
                    className="w-full h-auto object-contain object-top transition-transform duration-700 hover:scale-[1.01]"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
