"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  ArrowUpRight,
  Bot,
  FileSpreadsheet,
  Layers,
  Package,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Accent, SectionHeading } from "./_shared/section-heading";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type Feature = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
};

const FEATURES: Feature[] = [
  {
    icon: Bot,
    title: "WhatsApp integrado",
    description:
      "Consulte propostas, financeiro e documentos pelo WhatsApp. A Lia responde sobre o seu negócio em segundos.",
  },
  {
    icon: Users,
    title: "Clientes e fornecedores",
    description:
      "Base única de contatos com cadastro completo para vendas, pós-venda e operação financeira.",
  },
  {
    icon: Package,
    title: "Catálogo comercial",
    description:
      "Produtos e serviços com preço, margem e estoque, prontos para usar nas propostas.",
  },
  {
    icon: ShieldCheck,
    title: "Equipe e permissões",
    description:
      "Controle de acesso por módulo e ação para delegar tarefas com segurança operacional.",
  },
  {
    icon: Layers,
    title: "Soluções e ambientes",
    description:
      "Templates de soluções com ambientes e itens padrão para acelerar propostas complexas.",
  },
  {
    icon: FileSpreadsheet,
    title: "Planilhas personalizadas",
    description:
      "Crie planilhas internas por empresa para organizar dados de operação fora do fluxo padrão.",
  },
];

/**
 * Recursos — formato editorial de "ledger" (lista dividida por hairlines), sem
 * cards. Layout assimétrico: heading sticky à esquerda, lista de capacidades à
 * direita com índice, ícone e reveal em stagger. Hospeda as âncoras `#modulos` e
 * `#showcase` (a antiga seção Módulos foi removida) além do `#recursos`.
 */
export function LandingFeatures() {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = containerRef.current;
      if (!section) return;

      section
        .querySelectorAll<HTMLElement>(".features-heading")
        .forEach((item) => {
          gsap.fromTo(
            item,
            { y: 22, opacity: 0, autoAlpha: 0 },
            {
              y: 0,
              opacity: 1,
              autoAlpha: 1,
              ease: "none",
              scrollTrigger: {
                trigger: item,
                start: "top 94%",
                end: "top 64%",
                scrub: true,
                invalidateOnRefresh: true,
              },
            },
          );
        });

      gsap.utils.toArray<HTMLElement>(".feature-row").forEach((row, i) => {
        gsap.fromTo(
          row,
          { y: 24, opacity: 0, autoAlpha: 0 },
          {
            y: 0,
            opacity: 1,
            autoAlpha: 1,
            duration: 0.6,
            delay: i * 0.05,
            ease: "power3.out",
            scrollTrigger: {
              trigger: row,
              start: "top 92%",
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
      id="recursos"
      className="relative border-t border-black/10 bg-black/[0.015] py-28 dark:border-white/10 dark:bg-white/[0.02]"
    >
      {/* âncoras herdadas (navbar/footer) da antiga seção Módulos */}
      <span id="showcase" aria-hidden className="absolute -top-24" />
      <span id="modulos" aria-hidden className="absolute -top-24" />

      <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading
            align="left"
            eyebrow="Recursos da plataforma"
            title={
              <>
                Tudo que você precisa para <Accent>operar</Accent>
              </>
            }
            description="Os recursos que sustentam o dia a dia — do primeiro contato ao pós-venda — em uma base única e conectada."
            className="features-heading"
          />
        </div>

        <div className="border-b border-black/10 dark:border-white/10">
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="feature-row group relative flex items-start gap-5 border-t border-black/10 px-4 py-7 transition-colors duration-300 hover:bg-black/[0.02] dark:border-white/10 dark:hover:bg-white/[0.03] sm:gap-6"
              >
                <span className="mt-1 hidden w-8 shrink-0 text-sm font-semibold tabular-nums text-black/35 dark:text-white/35 sm:block">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-full border border-black/10 bg-white text-black transition-transform duration-300 group-hover:-translate-y-0.5 dark:border-white/15 dark:bg-white/[0.05] dark:text-white">
                  <Icon className="h-5 w-5" />
                </span>

                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-black dark:text-white md:text-xl">
                    {feature.title}
                  </h3>
                  <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-black/60 dark:text-white/65 md:text-[15px]">
                    {feature.description}
                  </p>
                </div>

                <ArrowUpRight className="mt-1 h-5 w-5 shrink-0 -translate-x-1 text-black/40 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 dark:text-white/40" />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
