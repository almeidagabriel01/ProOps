"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  Database,
  Download,
  KeyRound,
  Lock,
  Server,
  ShieldCheck,
} from "lucide-react";
import { Accent, SectionHeading } from "./_shared/section-heading";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const PILLARS = [
  {
    icon: ShieldCheck,
    title: "Conformidade com a LGPD",
    description:
      "Tratamento de dados pessoais conforme a Lei Geral de Proteção de Dados, com exclusão sob demanda.",
  },
  {
    icon: Lock,
    title: "Criptografia em trânsito e em repouso",
    description:
      "Conexões protegidas por TLS e dados sensíveis cifrados — inclusive integrações como o Google Agenda.",
  },
  {
    icon: Server,
    title: "Isolamento multi-tenant",
    description:
      "Cada empresa acessa apenas os próprios dados, com regras de segurança aplicadas em cada requisição.",
  },
  {
    icon: Database,
    title: "Backups e redundância",
    description:
      "Infraestrutura gerenciada com redundância e rotinas de backup para que nada se perca.",
  },
];

const BADGES = [
  { label: "LGPD", icon: ShieldCheck },
  { label: "TLS/SSL", icon: Lock },
  { label: "Backups diários", icon: Database },
  { label: "Exportação livre", icon: Download },
];

// Nós orbitais do emblema (posicionados nos pontos cardeais, sempre na vertical).
const NODES = [
  { icon: Lock, label: "Criptografia TLS", pos: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2" },
  { icon: Server, label: "Isolamento multi-tenant", pos: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2" },
  { icon: Database, label: "Backups e redundância", pos: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2" },
  { icon: KeyRound, label: "Controle de acesso", pos: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2" },
];

/**
 * Segurança & LGPD — layout assimétrico (lista de pilares à esquerda, emblema
 * orbital à direita). Sem cards: os pilares viram uma lista com divisórias finas;
 * a prova de confiança usa o componente Badge e o emblema usa Tooltip para rotular
 * os nós (componentes do design system). Os anéis giram só com motion habilitado
 * (motion-safe) e o reveal é coreografado com guarda de prefers-reduced-motion.
 */
export function LandingSecurity() {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = containerRef.current;
      if (!section) return;

      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.utils.toArray<HTMLElement>(".security-fade").forEach((el, i) => {
          gsap.fromTo(
            el,
            { y: 26, opacity: 0, autoAlpha: 0 },
            {
              y: 0,
              opacity: 1,
              autoAlpha: 1,
              duration: 0.7,
              delay: (i % 4) * 0.06,
              ease: "power3.out",
              scrollTrigger: {
                trigger: el,
                start: "top 90%",
                invalidateOnRefresh: true,
              },
            },
          );
        });

        const nodes = gsap.utils.toArray<HTMLElement>(".security-node");
        if (nodes.length) {
          gsap.fromTo(
            nodes,
            { scale: 0.4, autoAlpha: 0 },
            {
              scale: 1,
              autoAlpha: 1,
              duration: 0.6,
              ease: "back.out(1.7)",
              stagger: 0.1,
              scrollTrigger: {
                trigger: ".security-emblem",
                start: "top 80%",
                invalidateOnRefresh: true,
              },
            },
          );
        }
      });

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set([".security-fade", ".security-node"], {
          autoAlpha: 1,
          opacity: 1,
          scale: 1,
          y: 0,
        });
      });

      return () => mm.revert();
    },
    { scope: containerRef },
  );

  return (
    <section
      ref={containerRef}
      className="relative overflow-hidden border-t border-black/10 bg-white py-28 dark:border-white/10 dark:bg-neutral-950"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-16 px-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <SectionHeading
            align="left"
            eyebrow="Segurança & privacidade"
            title={
              <>
                Seus dados <Accent>protegidos</Accent> por padrão
              </>
            }
            description="Segurança não é um recurso à parte — é a base da plataforma. Veja como cuidamos das informações do seu negócio e dos seus clientes."
            className="security-fade mb-10"
          />

          {/* pilares em lista com divisórias finas — sem cards */}
          <div className="divide-y divide-black/10 border-y border-black/10 dark:divide-white/10 dark:border-white/10">
            {PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.title}
                  className="security-fade group flex items-start gap-4 py-5 sm:py-6"
                >
                  <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-black/10 text-black transition-colors duration-300 group-hover:border-black/30 dark:border-white/10 dark:text-white dark:group-hover:border-white/30">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="transition-transform duration-300 group-hover:translate-x-0.5">
                    <h3 className="font-semibold text-black dark:text-white">
                      {pillar.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-black/60 dark:text-white/60">
                      {pillar.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* prova de confiança — componente Badge */}
          <div className="security-fade mt-8 flex flex-wrap items-center gap-2.5">
            {BADGES.map((badge) => {
              const Icon = badge.icon;
              return (
                <Badge
                  key={badge.label}
                  variant="outline"
                  className="gap-1.5 px-3 py-1.5 uppercase tracking-wider text-black/70 dark:text-white/75"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {badge.label}
                </Badge>
              );
            })}
          </div>
        </div>

        {/* emblema orbital */}
        <div className="security-fade flex justify-center lg:col-span-2">
          <div className="security-emblem relative aspect-square w-full max-w-[22rem]">
            <div className="absolute inset-0 rounded-full border border-dashed border-black/15 motion-safe:[animation:smooth-spin_32s_linear_infinite] dark:border-white/15" />
            <div className="absolute inset-[14%] rounded-full border border-black/10 motion-safe:[animation:smooth-spin_22s_linear_infinite_reverse] dark:border-white/10" />
            <div className="absolute inset-[28%] rounded-full border border-dotted border-black/20 motion-safe:[animation:smooth-spin_40s_linear_infinite] dark:border-white/20" />

            {/* nós orbitais com Tooltip (design system) */}
            {NODES.map((node) => {
              const Icon = node.icon;
              return (
                <div key={node.label} className={`security-node absolute ${node.pos}`}>
                  <Tooltip content={node.label} side="top" delayMs={60} flipVerticalWhenNeeded>
                    <span className="grid h-12 w-12 cursor-default place-items-center rounded-full border border-black/10 bg-white text-black shadow-[0_8px_24px_-12px_rgba(0,0,0,0.4)] transition-colors duration-300 hover:border-black/30 dark:border-white/15 dark:bg-neutral-900 dark:text-white dark:hover:border-white/40">
                      <Icon className="h-5 w-5" />
                    </span>
                  </Tooltip>
                </div>
              );
            })}

            {/* núcleo: shield com glow pulsante */}
            <div className="absolute inset-[36%] grid place-items-center rounded-full border border-black/15 bg-black/[0.03] backdrop-blur-sm dark:border-white/15 dark:bg-white/[0.05]">
              <div className="animate-pulse-slow absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.12),transparent_70%)] dark:bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.18),transparent_70%)]" />
              <ShieldCheck className="relative h-12 w-12 text-black dark:text-white" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
