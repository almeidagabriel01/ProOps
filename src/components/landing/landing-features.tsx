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
    title: "Automações e integrações",
    description:
      "Backend pronto para fluxos com WhatsApp, webhooks e API para conectar ferramentas externas.",
  },
];

export function LandingFeatures() {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = containerRef.current;
      if (!section) return;

      const headingItems = section.querySelectorAll<HTMLElement>(".features-heading");
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
      className="py-28 relative bg-black/[0.015] dark:bg-white/[0.03] border-t border-black/10 dark:border-white/10"
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-16 text-center">
          <h2 className="text-sm font-semibold text-black/70 dark:text-white/70 uppercase tracking-wider mb-3 features-heading">
            Recursos da Plataforma
          </h2>
          <h3 className="text-4xl md:text-5xl font-bold mb-6 max-w-4xl mx-auto text-black dark:text-white features-heading">
            Funcionalidades conectadas ao que você usa no dia a dia.
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURE_CARDS.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="relative overflow-hidden p-7 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 transition-all duration-300 group feature-card hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-black/[0.04] dark:from-white/[0.08] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <div className="relative z-10">
                  <div className="w-11 h-11 rounded-lg bg-black/[0.04] dark:bg-white/[0.08] border border-black/10 dark:border-white/10 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-300">
                    <Icon className="text-black dark:text-white w-5 h-5" />
                  </div>
                  <h4 className="text-xl font-semibold mb-3 text-black dark:text-white">
                    {feature.title}
                  </h4>
                  <p className="text-black/65 dark:text-white/70 text-sm leading-relaxed">
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

