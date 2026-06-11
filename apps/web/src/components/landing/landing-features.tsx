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
                className="feature-row group relative flex items-start gap-5 border-t border-black/10 py-7 pl-6 pr-4 transition-colors duration-300 hover:bg-black/[0.025] dark:border-white/10 dark:hover:bg-white/[0.04] sm:gap-6"
              >
                {/* barra de acento que cresce no hover */}
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-0 w-[3px] -translate-y-1/2 rounded-full bg-black transition-all duration-300 ease-out group-hover:h-[56%] dark:bg-white"
                />

                <span className="mt-1.5 hidden w-7 shrink-0 text-sm font-semibold tabular-nums text-black/30 transition-colors duration-300 group-hover:text-black/70 dark:text-white/30 dark:group-hover:text-white/70 sm:block">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <span className="mt-0.5 grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-black/10 bg-black/[0.03] text-black transition-all duration-300 group-hover:-translate-y-0.5 group-hover:scale-[1.04] group-hover:border-transparent group-hover:bg-black group-hover:text-white group-hover:shadow-[0_10px_24px_-10px_rgba(0,0,0,0.5)] dark:border-white/12 dark:bg-white/[0.06] dark:text-white dark:group-hover:bg-white dark:group-hover:text-black dark:group-hover:shadow-[0_10px_24px_-10px_rgba(0,0,0,0.8)]">
                  <Icon className="h-5 w-5" />
                </span>

                <div className="flex-1 transition-transform duration-300 group-hover:translate-x-0.5">
                  <h3 className="text-lg font-semibold text-black dark:text-white md:text-xl">
                    {feature.title}
                  </h3>
                  <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-black/60 dark:text-white/65 md:text-[15px]">
                    {feature.description}
                  </p>
                </div>

                <ArrowUpRight className="mt-2 h-5 w-5 shrink-0 -translate-x-1 text-black/40 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 dark:text-white/40" />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
