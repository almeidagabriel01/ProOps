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
  Sparkles,
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
  { label: "Lia (IA)", icon: Sparkles },
];

const RIGHT: Integration[] = [
  { label: "Stripe", icon: CreditCard },
  { label: "Pix", icon: QrCode },
  { label: "Asaas", icon: Banknote },
];

// Posições verticais (% da altura do painel) dos badges e dos pontos de conexão.
const ROWS = [22, 50, 78];

// Conectores no espaço do viewBox 240x100 (mesma proporção do painel via
// aspect-[240/100]). As linhas saem na altura ROWS[i] (= centro do badge), o
// início (x=40 / x=200) fica sob o badge, e o fim (x=101 / x=139) para na beirada
// da logo central — sem ir até o centro (120,50) atrás dela.
const CONNECTORS = [
  "M 40 22 C 78 22, 93 50, 101 50",
  "M 40 50 L 101 50",
  "M 40 78 C 78 78, 93 50, 101 50",
  "M 200 22 C 162 22, 147 50, 139 50",
  "M 200 50 L 139 50",
  "M 200 78 C 162 78, 147 50, 139 50",
];

function Pill({
  icon: Icon,
  label,
  index,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  index: number;
}) {
  const delay = `${(index % 3) * 0.45}s`;
  return (
    // wrapper externo = alvo do reveal do GSAP (scale/opacity) — separado do
    // pulse para os transforms não conflitarem
    <div className="integration-node inline-block">
      <div
        className="animate-badge-pulse relative flex w-48 items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 py-2.5 dark:border-white/20 dark:bg-gradient-to-b dark:from-neutral-800 dark:to-neutral-900"
        style={{ animationDelay: delay }}
      >
        <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-neutral-950 text-white">
          {/* glow do ícone pulsante */}
          <span
            aria-hidden
            className="animate-pulse-slow absolute -inset-1 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.4),transparent_68%)]"
            style={{ animationDelay: delay }}
          />
          <Icon className="relative h-4 w-4" />
        </span>
        <span className="relative truncate text-sm font-medium text-black dark:text-white">
          {label}
        </span>
      </div>
    </div>
  );
}

function CenterLogo() {
  // O PNG do símbolo (1600x900) tem muito espaço transparente em volta da marca;
  // recortamos via janela overflow-hidden + scale (transform não sofre o
  // max-width:100% do preflight, ao contrário de largar a largura).
  return (
    <div className="integration-node relative grid h-40 w-40 place-items-center overflow-hidden">
      <ProOpsLogo
        variant="symbol"
        width={720}
        height={405}
        invertOnDark
        interactive={false}
        className="h-auto w-40 origin-center scale-[4]"
      />
    </div>
  );
}

/**
 * Integrações — hub central com a marca ProOps e os serviços à esquerda/direita,
 * ligados por conectores contínuos com um único traço de luz percorrendo até o
 * centro (`.animate-flow`). Badges com largura fixa, visual flat, pulse de escala
 * (ícone acompanha) e posicionamento absoluto alinhado às conexões. No mobile vira
 * um empilhamento simples sem os conectores.
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
          <div className="relative hidden aspect-[240/100] md:block">
            <svg
              aria-hidden
              viewBox="0 0 240 100"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 z-0 h-full w-full"
            >
              {CONNECTORS.map((d, i) => (
                <g key={d}>
                  {/* linha base contínua */}
                  <path
                    d={d}
                    fill="none"
                    strokeWidth={0.35}
                    className="stroke-black/18 dark:stroke-white/22"
                  />
                  {/* único traço de luz percorrendo a linha */}
                  <path
                    d={d}
                    fill="none"
                    pathLength={100}
                    strokeDasharray="16 84"
                    strokeWidth={0.5}
                    strokeLinecap="round"
                    className="animate-flow stroke-black/55 dark:stroke-white/90"
                    style={{ animationDelay: `${i * 0.26}s` }}
                  />
                </g>
              ))}
            </svg>

            {/* marca central */}
            <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
              <CenterLogo />
            </div>

            {/* badges posicionados nas alturas exatas das conexões */}
            {LEFT.map((item, i) => (
              <div
                key={item.label}
                className="absolute left-0 z-10 -translate-y-1/2"
                style={{ top: `${ROWS[i]}%` }}
              >
                <Pill icon={item.icon} label={item.label} index={i} />
              </div>
            ))}
            {RIGHT.map((item, i) => (
              <div
                key={item.label}
                className="absolute right-0 z-10 -translate-y-1/2"
                style={{ top: `${ROWS[i]}%` }}
              >
                <Pill icon={item.icon} label={item.label} index={i} />
              </div>
            ))}
          </div>

          {/* ===== Mobile: empilhamento simples ===== */}
          <div className="relative flex flex-col items-center gap-8 md:hidden">
            <CenterLogo />
            <div className="grid w-full grid-cols-2 place-items-center gap-3">
              {[...LEFT, ...RIGHT].map((item, i) => (
                <Pill key={item.label} icon={item.icon} label={item.label} index={i} />
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
