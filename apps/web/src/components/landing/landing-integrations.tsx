"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  Banknote,
  Barcode,
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

type Node = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  x: number;
  y: number;
};

// posições em % numa circunferência ao redor do centro (50,50), raio ~38
const NODES: Node[] = [
  { label: "WhatsApp", icon: MessageCircle, x: 50, y: 12 },
  { label: "Stripe", icon: CreditCard, x: 80, y: 26 },
  { label: "MercadoPago", icon: ShoppingBag, x: 87, y: 58 },
  { label: "Asaas", icon: Banknote, x: 66, y: 84 },
  { label: "Pix", icon: QrCode, x: 34, y: 84 },
  { label: "Boleto", icon: Barcode, x: 13, y: 58 },
  { label: "Google Agenda", icon: Calendar, x: 20, y: 26 },
];

/**
 * Integrações — constelação: marca ProOps ao centro, integrações como satélites
 * ligados por linhas finas. Nós entram em stagger via GSAP. Em telas pequenas a
 * constelação encolhe e há uma legenda de chips para clareza/acessibilidade.
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
          { scale: 0.4, opacity: 0 },
          {
            scale: 1,
            opacity: 1,
            duration: 0.6,
            ease: "back.out(1.8)",
            stagger: 0.08,
            scrollTrigger: {
              trigger: section,
              start: "top 70%",
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
          className="mb-16"
        />

        <div className="relative mx-auto aspect-square w-full max-w-xl">
          {/* linhas de conexão centro → satélites */}
          <svg
            aria-hidden
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
          >
            {NODES.map((node) => (
              <line
                key={node.label}
                x1="50"
                y1="50"
                x2={node.x}
                y2={node.y}
                className="stroke-black/12 dark:stroke-white/15"
                strokeWidth="0.4"
              />
            ))}
          </svg>

          {/* centro: marca ProOps */}
          <div className="integration-node absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="relative grid h-24 w-24 place-items-center rounded-3xl border border-black/10 bg-white shadow-[0_20px_50px_-20px_rgba(0,0,0,0.4)] dark:border-white/15 dark:bg-neutral-900 dark:shadow-[0_20px_50px_-18px_rgba(0,0,0,0.8)]">
              <div className="animate-pulse-slow absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.06),transparent_70%)] dark:bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12),transparent_70%)]" />
              <ProOpsLogo
                variant="symbol"
                width={44}
                height={44}
                invertOnDark
                className="relative h-11 w-11"
              />
            </div>
          </div>

          {/* satélites */}
          {NODES.map((node) => {
            const Icon = node.icon;
            return (
              <div
                key={node.label}
                className="integration-node group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2"
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
              >
                <div className="grid h-14 w-14 place-items-center rounded-2xl border border-black/10 bg-white/80 backdrop-blur transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-black/25 group-hover:shadow-[0_12px_30px_-12px_rgba(0,0,0,0.4)] dark:border-white/10 dark:bg-white/[0.06] dark:group-hover:border-white/30">
                  <Icon className="h-6 w-6 text-black dark:text-white" />
                </div>
                <span className="text-xs font-medium text-black/60 dark:text-white/60">
                  {node.label}
                </span>
              </div>
            );
          })}
        </div>

        <p className="mx-auto mt-10 max-w-xl text-center text-sm text-black/55 dark:text-white/55">
          Não vê a integração que precisa? Fale com a gente — avaliamos novas
          conexões conforme a demanda.
        </p>
      </div>
    </section>
  );
}
