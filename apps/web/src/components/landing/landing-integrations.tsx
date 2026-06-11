"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  Banknote,
  Calendar,
  CreditCard,
  MessageCircle,
  QrCode,
  ShoppingBag,
} from "lucide-react";
import { ProOpsLogo } from "@/components/branding/proops-logo";
import { Accent, SectionHeading } from "./_shared/section-heading";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type Integration = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const LEFT: Integration[] = [
  { label: "WhatsApp", icon: MessageCircle },
  { label: "Google Agenda", icon: Calendar },
  { label: "Pix", icon: QrCode },
];

const RIGHT: Integration[] = [
  { label: "Stripe", icon: CreditCard },
  { label: "MercadoPago", icon: ShoppingBag },
  { label: "Asaas", icon: Banknote },
];

// Conectores curvos (viewBox 0..100) do pillar ao centro (50,50). O início
// (x=18 / x=82) fica sob os pills, escondendo a junção.
const CONNECTORS = [
  "M 18 22 C 38 22, 38 50, 50 50",
  "M 18 50 L 50 50",
  "M 18 78 C 38 78, 38 50, 50 50",
  "M 82 22 C 62 22, 62 50, 50 50",
  "M 82 50 L 50 50",
  "M 82 78 C 62 78, 62 50, 50 50",
];

function Pill({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="integration-node inline-flex items-center gap-2.5 rounded-full border border-black/10 bg-white/85 px-4 py-2.5 shadow-[0_8px_20px_-12px_rgba(0,0,0,0.4)] backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-black/20 dark:border-white/10 dark:bg-white/[0.06] dark:shadow-[0_10px_24px_-12px_rgba(0,0,0,0.75)] dark:hover:border-white/25">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-black/[0.05] text-black dark:bg-white/10 dark:text-white">
        <Icon className="h-4 w-4" />
      </span>
      <span className="whitespace-nowrap text-sm font-medium text-black dark:text-white">
        {label}
      </span>
    </div>
  );
}

function CenterLogo() {
  return (
    <div className="integration-node relative grid h-28 w-28 place-items-center rounded-[1.7rem] border border-black/10 bg-white shadow-[0_20px_50px_-18px_rgba(0,0,0,0.45)] dark:border-white/15 dark:bg-neutral-900 dark:shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)]">
      <div className="animate-pulse-slow absolute -inset-3 rounded-[2.1rem] bg-[radial-gradient(circle,rgba(0,0,0,0.08),transparent_65%)] dark:bg-[radial-gradient(circle,rgba(255,255,255,0.16),transparent_65%)]" />
      <ProOpsLogo
        variant="symbol"
        width={56}
        height={56}
        invertOnDark
        className="relative h-14 w-14"
      />
    </div>
  );
}

/**
 * Integrações — hub central com a marca ProOps e os serviços à esquerda/direita,
 * ligados por conectores curvos com um pulso de luz que corre até o centro
 * (`.animate-flow`, desativado sob prefers-reduced-motion). No mobile vira um
 * empilhamento simples sem os conectores.
 */
export function LandingIntegrations() {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = containerRef.current;
      if (!section) return;

      const nodes = gsap.utils.toArray<HTMLElement>(".integration-node");
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          nodes,
          { scale: 0.6, opacity: 0 },
          {
            scale: 1,
            opacity: 1,
            duration: 0.55,
            ease: "back.out(1.7)",
            stagger: 0.07,
            scrollTrigger: {
              trigger: section,
              start: "top 72%",
              invalidateOnRefresh: true,
            },
          },
        );
      });

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(nodes, { opacity: 1, scale: 1 });
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
      <div className="mx-auto max-w-5xl px-6">
        <SectionHeading
          eyebrow="Integrações"
          title={
            <>
              Conectado ao que você <Accent>já usa</Accent>
            </>
          }
          description="Pagamentos, mensagens e agenda em um fluxo só. Pix, boleto e cartão via Stripe, MercadoPago e Asaas — sem trocar de tela."
          className="mb-14"
        />

        <div className="relative overflow-hidden rounded-[2rem] border border-black/10 bg-gradient-to-b from-black/[0.02] to-transparent p-6 dark:border-white/10 dark:from-white/[0.04] sm:p-10">
          <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.05),transparent_70%)] dark:bg-[radial-gradient(circle,rgba(255,255,255,0.08),transparent_70%)]" />
          <div className="grain-overlay opacity-[0.03]" />

          {/* ===== Desktop: hub com conectores ===== */}
          <div className="relative hidden min-h-[24rem] grid-cols-[1fr_auto_1fr] items-center gap-4 md:grid">
            <svg
              aria-hidden
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 z-0 h-full w-full"
            >
              {CONNECTORS.map((d, i) => (
                <g key={d}>
                  <path
                    d={d}
                    fill="none"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                    className="stroke-black/12 dark:stroke-white/15"
                  />
                  <path
                    d={d}
                    fill="none"
                    pathLength={100}
                    strokeDasharray="10 90"
                    strokeWidth={1.4}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    className="animate-flow stroke-black/45 dark:stroke-white/80"
                    style={{ animationDelay: `${i * 0.32}s` }}
                  />
                </g>
              ))}
            </svg>

            <div className="relative z-10 flex min-h-[20rem] flex-col items-start justify-between py-2">
              {LEFT.map((item) => (
                <Pill key={item.label} icon={item.icon} label={item.label} />
              ))}
            </div>

            <div className="relative z-10 flex justify-center px-2">
              <CenterLogo />
            </div>

            <div className="relative z-10 flex min-h-[20rem] flex-col items-end justify-between py-2">
              {RIGHT.map((item) => (
                <Pill key={item.label} icon={item.icon} label={item.label} />
              ))}
            </div>
          </div>

          {/* ===== Mobile: empilhamento simples ===== */}
          <div className="relative flex flex-col items-center gap-8 md:hidden">
            <CenterLogo />
            <div className="grid w-full grid-cols-2 gap-3">
              {[...LEFT, ...RIGHT].map((item) => (
                <Pill key={item.label} icon={item.icon} label={item.label} />
              ))}
            </div>
          </div>
        </div>

        <p className="mx-auto mt-10 max-w-xl text-center text-sm text-black/55 dark:text-white/55">
          Não vê a integração que precisa? Fale com a gente — avaliamos novas
          conexões conforme a demanda.
        </p>
      </div>
    </section>
  );
}
