"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Database, KeyRound, Lock, Server, ShieldCheck } from "lucide-react";
import { MonoField } from "./_shared/mono-field";
import { Accent, SectionHeading } from "./_shared/section-heading";

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

const BADGES = ["LGPD", "TLS/SSL", "Backups diários", "Exportação livre"];

/**
 * Segurança & LGPD — faixa full-bleed escura, layout assimétrico (texto à
 * esquerda, emblema de anéis concêntricos à direita). Os anéis giram apenas com
 * motion habilitado (motion-safe). Prova de confiança sem depoimentos — adequada
 * a um produto em pré-lançamento.
 */
export function LandingSecurity() {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = containerRef.current;
      if (!section) return;

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
    },
    { scope: containerRef },
  );

  return (
    <section
      ref={containerRef}
      className="relative overflow-hidden bg-[#0a0a0a] py-28 text-white dark:bg-black"
    >
      <MonoField />

      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-16 px-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <SectionHeading
            invert
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

          <div className="grid gap-5 sm:grid-cols-2">
            {PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.title}
                  className="security-fade rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm transition-colors duration-300 hover:border-white/20 hover:bg-white/[0.07]"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="font-semibold text-white">{pillar.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/60">
                    {pillar.description}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="security-fade mt-8 flex flex-wrap items-center gap-3">
            {BADGES.map((badge) => (
              <span
                key={badge}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/75"
              >
                <KeyRound className="h-3.5 w-3.5" />
                {badge}
              </span>
            ))}
          </div>
        </div>

        {/* emblema: anéis concêntricos */}
        <div className="security-fade flex justify-center lg:col-span-2">
          <div className="relative aspect-square w-full max-w-[20rem]">
            <div className="absolute inset-0 rounded-full border border-dashed border-white/15 motion-safe:[animation:smooth-spin_28s_linear_infinite]" />
            <div className="absolute inset-[12%] rounded-full border border-white/10 motion-safe:[animation:smooth-spin_20s_linear_infinite_reverse]" />
            <div className="absolute inset-[24%] rounded-full border border-dotted border-white/20 motion-safe:[animation:smooth-spin_34s_linear_infinite]" />
            <div className="absolute inset-[34%] grid place-items-center rounded-full border border-white/15 bg-white/[0.05] backdrop-blur-sm">
              <div className="animate-pulse-slow absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.18),transparent_70%)]" />
              <ShieldCheck className="relative h-14 w-14 text-white" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
