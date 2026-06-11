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
import { MonoGlassCard } from "./_shared/mono-glass-card";
import { Accent, SectionHeading } from "./_shared/section-heading";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type FeatureCard = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  span: string;
  hero?: boolean;
};

const FEATURE_CARDS: FeatureCard[] = [
  {
    icon: Bot,
    title: "WhatsApp integrado",
    description:
      "Consulte propostas, financeiro e documentos direto no celular. A Lia responde sobre o seu negócio em segundos, sem abrir o sistema.",
    span: "lg:col-span-2 lg:row-span-2",
    hero: true,
  },
  {
    icon: Users,
    title: "Clientes e fornecedores",
    description:
      "Base única de contatos com cadastro completo para vendas, pós-venda e operação financeira.",
    span: "lg:col-span-2",
  },
  {
    icon: Package,
    title: "Catálogo comercial",
    description:
      "Produtos e serviços com preço, margem e estoque, prontos para usar nas propostas.",
    span: "lg:col-span-1",
  },
  {
    icon: ShieldCheck,
    title: "Equipe e permissões",
    description:
      "Controle de acesso por módulo e ação para delegar com segurança.",
    span: "lg:col-span-1",
  },
  {
    icon: Layers,
    title: "Soluções e ambientes",
    description:
      "Templates de soluções com ambientes e itens padrão para acelerar propostas complexas.",
    span: "lg:col-span-2",
  },
  {
    icon: FileSpreadsheet,
    title: "Planilhas personalizadas",
    description:
      "Crie planilhas internas por empresa para organizar dados fora do fluxo padrão.",
    span: "lg:col-span-2",
  },
];

function WhatsAppMock() {
  return (
    <div className="mt-6 space-y-2.5">
      <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-black/10 bg-black/[0.04] px-3.5 py-2 text-sm text-black/75 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/75">
        Qual o faturamento deste mês?
      </div>
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-black px-3.5 py-2 text-sm text-white dark:bg-white dark:text-black">
        R$ 48.250 em propostas aprovadas, com 3 pagamentos pendentes para esta
        semana.
      </div>
      <div className="flex items-center gap-1 pl-1 pt-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-black/30 [animation-delay:-0.3s] dark:bg-white/40" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-black/30 [animation-delay:-0.15s] dark:bg-white/40" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-black/30 dark:bg-white/40" />
      </div>
    </div>
  );
}

/**
 * Recursos — bento assimétrico (4 col no desktop) com célula-herói do WhatsApp/Lia
 * e mock de conversa. Cada célula é um MonoGlassCard (tilt + spotlight); reveal em
 * stagger via GSAP. Quebra o antigo grid 3-col chapado.
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
                end: "top 68%",
                scrub: true,
                invalidateOnRefresh: true,
              },
            },
          );
        });

      gsap.utils.toArray<HTMLElement>(".feature-card").forEach((card, i) => {
        gsap.fromTo(
          card,
          { y: 30, opacity: 0, autoAlpha: 0 },
          {
            y: 0,
            opacity: 1,
            autoAlpha: 1,
            duration: 0.7,
            delay: (i % 3) * 0.06,
            ease: "power3.out",
            scrollTrigger: {
              trigger: card,
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
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="Recursos da plataforma"
          title={
            <>
              Tudo que você precisa para <Accent>operar</Accent>
            </>
          }
          description="Os recursos que sustentam o dia a dia — do primeiro contato ao pós-venda — em uma base única."
          className="features-heading mb-16"
        />

        <div className="grid auto-rows-[minmax(13rem,1fr)] grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURE_CARDS.map((feature) => {
            const Icon = feature.icon;
            return (
              <MonoGlassCard
                key={feature.title}
                maxTilt={4}
                className={`feature-card p-7 ${feature.span}`}
              >
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-black/[0.04] dark:border-white/10 dark:bg-white/[0.08]">
                  <Icon className="h-5 w-5 text-black dark:text-white" />
                </div>
                <h3
                  className={`font-semibold text-black dark:text-white ${
                    feature.hero ? "text-2xl" : "text-xl"
                  }`}
                >
                  {feature.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-black/65 dark:text-white/70">
                  {feature.description}
                </p>
                {feature.hero && <WhatsAppMock />}
              </MonoGlassCard>
            );
          })}
        </div>
      </div>
    </section>
  );
}
