"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  Bot,
  FileSpreadsheet,
  Layers,
  Package,
  ShieldCheck,
  Users,
} from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const FEATURE_CARDS = [
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
      "Gestão de produtos e serviços com preço, margem, estoque e uso direto nas propostas.",
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
  {
    icon: Bot,
    title: "WhatsApp integrado",
    description:
      "Consultas rápidas de propostas, financeiro e documentos direto no celular via WhatsApp.",
  },
];

export function LandingFeatures() {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = containerRef.current;
      if (!section) return;

      const headingItems =
        section.querySelectorAll<HTMLElement>(".features-heading");
      headingItems.forEach((item) => {
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
              end: "top 68%",
              scrub: true,
              invalidateOnRefresh: true,
            },
          },
        );
      });

      const cards = section.querySelectorAll<HTMLElement>(".feature-card");
      cards.forEach((card) => {
        gsap.fromTo(
          card,
          { y: 26, opacity: 0, autoAlpha: 0 },
          {
            y: 0,
            opacity: 1,
            autoAlpha: 1,
            ease: "none",
            scrollTrigger: {
              trigger: card,
              start: "top 98%",
              end: "top 70%",
              scrub: true,
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
      className="relative border-t border-black/10 bg-black/[0.015] py-28 dark:border-white/10 dark:bg-white/[0.03]"
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 text-center">
          <h2 className="features-heading mb-3 text-sm font-semibold uppercase tracking-wider text-black/70 dark:text-white/70">
            Recursos da Plataforma
          </h2>
          <h3 className="features-heading mx-auto mb-6 max-w-4xl text-4xl font-bold text-black dark:text-white md:text-5xl">
            Tudo que você precisa para operar.
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURE_CARDS.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="feature-card group relative overflow-hidden rounded-2xl border border-black/10 bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(0,0,0,0.12)] dark:border-white/10 dark:bg-neutral-900 dark:hover:shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
              >
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/[0.04] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-white/[0.08]" />
                <div className="relative z-10">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg border border-black/10 bg-black/[0.04] transition-transform duration-300 group-hover:scale-105 dark:border-white/10 dark:bg-white/[0.08]">
                    <Icon className="h-5 w-5 text-black dark:text-white" />
                  </div>
                  <h4 className="mb-3 text-xl font-semibold text-black dark:text-white">
                    {feature.title}
                  </h4>
                  <p className="text-sm leading-relaxed text-black/65 dark:text-white/70">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
