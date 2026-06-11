"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { FileText, LayoutDashboard, Send, UserPlus } from "lucide-react";
import { Accent, SectionHeading } from "./_shared/section-heading";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type Step = {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const STEPS: Step[] = [
  {
    title: "Cadastre sua base",
    description:
      "Importe clientes, fornecedores e o catálogo de produtos e serviços. Tudo em um lugar, pronto para usar nas propostas.",
    icon: UserPlus,
  },
  {
    title: "Monte a proposta",
    description:
      "Selecione itens, ambientes e soluções; personalize capa e seções e gere um PDF profissional com preview em tempo real.",
    icon: FileText,
  },
  {
    title: "Envie e feche",
    description:
      "Compartilhe por link ou WhatsApp e acompanhe o status de aprovação sem sair da plataforma.",
    icon: Send,
  },
  {
    title: "Gerencie a operação",
    description:
      "Financeiro, carteiras, agenda e CRM atualizados automaticamente a cada proposta aprovada — visão única do negócio.",
    icon: LayoutDashboard,
  },
];

/**
 * Como Funciona — "espinha" vertical que se desenha conforme o scroll (scaleY) e
 * nós que acendem ao serem alcançados. Background padronizado com a hero
 * (bg-white dark:bg-neutral-950) e cores theme-adaptive. Sob prefers-reduced-motion
 * a linha aparece completa e os nós ficam visíveis, sem animação.
 */
export function LandingHowItWorks() {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = containerRef.current;
      if (!section) return;

      const fill = section.querySelector<HTMLElement>(".how-line-fill");
      const nodes = gsap.utils.toArray<HTMLElement>(".how-node");
      const cards = gsap.utils.toArray<HTMLElement>(".how-card");
      const stepsWrap = section.querySelector<HTMLElement>(".how-steps");

      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (fill && stepsWrap) {
          gsap.fromTo(
            fill,
            { scaleY: 0 },
            {
              scaleY: 1,
              ease: "none",
              scrollTrigger: {
                trigger: stepsWrap,
                start: "top 70%",
                end: "bottom 70%",
                scrub: true,
                invalidateOnRefresh: true,
              },
            },
          );
        }

        nodes.forEach((node) => {
          gsap.fromTo(
            node,
            { scale: 0.6, opacity: 0.3 },
            {
              scale: 1,
              opacity: 1,
              duration: 0.4,
              ease: "back.out(2)",
              scrollTrigger: { trigger: node, start: "top 70%", invalidateOnRefresh: true },
            },
          );
        });

        cards.forEach((card) => {
          gsap.fromTo(
            card,
            { y: 26, opacity: 0, autoAlpha: 0 },
            {
              y: 0,
              opacity: 1,
              autoAlpha: 1,
              duration: 0.7,
              ease: "power3.out",
              scrollTrigger: { trigger: card, start: "top 88%", invalidateOnRefresh: true },
            },
          );
        });
      });

      mm.add("(prefers-reduced-motion: reduce)", () => {
        if (fill) gsap.set(fill, { scaleY: 1 });
      });

      return () => mm.revert();
    },
    { scope: containerRef },
  );

  return (
    <section
      ref={containerRef}
      className="relative overflow-hidden bg-white py-28 dark:bg-neutral-950"
    >
      <div className="mx-auto max-w-3xl px-6">
        <SectionHeading
          eyebrow="Como funciona"
          title={
            <>
              Da primeira proposta à <Accent>operação</Accent> rodando
            </>
          }
          description="Quatro passos para sair das planilhas soltas e do WhatsApp bagunçado para uma gestão integrada."
          className="mb-20"
        />

        <div className="how-steps relative">
          {/* trilho + preenchimento que se desenha no scroll */}
          <div
            aria-hidden
            className="absolute bottom-6 left-[27px] top-6 w-px bg-black/15 dark:bg-white/15"
          />
          <div
            aria-hidden
            className="how-line-fill absolute bottom-6 left-[27px] top-6 w-px origin-top bg-gradient-to-b from-black via-black to-black/40 dark:from-white dark:via-white dark:to-white/40"
          />

          <ol className="space-y-12">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.title}
                  className="relative grid grid-cols-[56px_1fr] items-start gap-6"
                >
                  <div className="relative flex justify-center">
                    <div className="how-node relative grid h-14 w-14 place-items-center rounded-full border border-black/15 bg-white shadow-[0_0_0_6px_#fff] dark:border-white/20 dark:bg-neutral-950 dark:shadow-[0_0_0_6px_#0a0a0a]">
                      <Icon className="h-5 w-5 text-black dark:text-white" />
                      <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-black text-[11px] font-bold text-white dark:bg-white dark:text-black">
                        {index + 1}
                      </span>
                    </div>
                  </div>

                  <div className="how-card rounded-2xl border border-black/10 bg-black/[0.02] p-6 backdrop-blur-sm transition-colors duration-300 hover:border-black/20 hover:bg-black/[0.04] dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/20 dark:hover:bg-white/[0.07]">
                    <h3 className="text-xl font-semibold text-black dark:text-white">
                      {step.title}
                    </h3>
                    <p className="mt-2 leading-relaxed text-black/65 dark:text-white/65">
                      {step.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
