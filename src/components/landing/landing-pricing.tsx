"use client";

import React, { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Check } from "lucide-react";
import { LandingPlan } from "./use-landing-page";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface LandingPricingProps {
  plans?: LandingPlan[];
  billingInterval?: "monthly" | "yearly";
  setBillingInterval?: (interval: "monthly" | "yearly") => void;
  isLoading?: boolean;
}

export function LandingPricing({
  billingInterval = "monthly",
  setBillingInterval,
}: LandingPricingProps) {
  const containerRef = useRef<HTMLElement>(null);
  const isAnnual = billingInterval === "yearly";

  useGSAP(
    () => {
      // Fade Up
      gsap.utils.toArray(".gsap-fade-up").forEach((el: unknown) => {
        const element = el as Element;
        gsap.fromTo(
          element,
          { y: 30, opacity: 0, autoAlpha: 0 },
          {
            y: 0,
            opacity: 1,
            autoAlpha: 1,
            duration: 0.65,
            ease: "power2.out",
            scrollTrigger: {
              trigger: element,
              start: "top 88%",
              end: "bottom 10%",
              toggleActions: "play none none reverse",
              fastScrollEnd: true,
            },
          },
        );
      });

      // Pricing Cards Cascade
      gsap.fromTo(
        ".pricing-card",
        { y: 50, opacity: 0, autoAlpha: 0 },
        {
          y: 0,
          opacity: 1,
          autoAlpha: 1,
          duration: 0.75,
          stagger: 0.12,
          ease: "power2.out",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 84%",
            end: "bottom 20%",
            toggleActions: "play none none reverse",
            fastScrollEnd: true,
          },
        },
      );
    },
    { scope: containerRef },
  );

  // Price animation effect when toggling
  useEffect(() => {
    const priceElements = document.querySelectorAll(".price-value");
    gsap.to(priceElements, {
      opacity: 0,
      y: -10,
      duration: 0.2,
      onComplete: () => {
        gsap.to(priceElements, {
          opacity: 1,
          y: 0,
          duration: 0.3,
          ease: "back.out(1.5)",
        });
      },
    });
  }, [isAnnual]);

  const handleToggle = () => {
    if (setBillingInterval) {
      setBillingInterval(isAnnual ? "monthly" : "yearly");
    }
  };

  return (
    <section
      ref={containerRef}
      id="pricing"
      className="py-32 relative border-y border-border bg-background overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(20,184,166,0.03)_0,transparent_70%)]"></div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-sm font-semibold text-brand-500 uppercase tracking-wider mb-3 gsap-fade-up">
            Planos & Preços
          </h2>
          <h3 className="text-4xl md:text-5xl font-bold mb-6 text-foreground gsap-fade-up">
            Escale sem surpresas.
          </h3>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto gsap-fade-up">
            Escolha o plano perfeito para o momento da sua empresa. Faça upgrade
            a qualquer momento conforme a sua operação cresce.
          </p>

          <div className="flex items-center justify-center gap-4 mt-10 gsap-fade-up">
            <span
              onClick={() =>
                setBillingInterval && setBillingInterval("monthly")
              }
              className={`font-medium transition-colors duration-300 cursor-pointer ${
                !isAnnual ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              Mensal
            </span>

            <button
              onClick={handleToggle}
              className="relative w-14 h-8 bg-muted border border-border rounded-full transition-colors duration-300 focus:outline-none flex items-center px-1"
            >
              <div
                className={`w-6 h-6 bg-brand-500 rounded-full shadow-md transform transition-transform duration-300 ${
                  isAnnual ? "translate-x-6" : ""
                }`}
              ></div>
            </button>

            <span
              onClick={() => setBillingInterval && setBillingInterval("yearly")}
              className={`font-medium transition-colors duration-300 flex items-center gap-2 cursor-pointer ${
                isAnnual ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              Anual
              <span className="text-[10px] bg-brand-500/10 border border-brand-500/20 text-brand-400 px-2 py-1 rounded-full uppercase tracking-wider font-bold">
                Poupe 20%
              </span>
            </span>
          </div>
        </div>

        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto"
          id="pricing-cards-container"
        >
          {/* Plano 1: Essencial */}
          <div className="pricing-card relative flex flex-col p-8 rounded-3xl border border-border bg-gradient-to-b from-card to-secondary transition-all duration-500 h-full group hover:border-border hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_20px_40px_-15px_rgba(255,255,255,0.05)]">
            <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-muted-foreground/30 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-700 origin-left"></div>
            </div>

            <h4 className="text-xl font-medium text-foreground mb-2">
              Essencial
            </h4>
            <p className="text-muted-foreground text-sm mb-6 h-10">
              Para pequenas empresas e equipas a começar a organizar a operação.
            </p>
            <div className="mb-8">
              <span className="text-4xl font-bold text-foreground">
                €<span className="price-value">{isAnnual ? "39" : "49"}</span>
              </span>
              <span className="text-muted-foreground text-sm">/mês</span>
            </div>
            <button className="w-full py-3 px-4 rounded-full border border-border text-foreground hover:bg-muted transition-colors font-medium mb-8">
              Começar Essencial
            </button>
            <div className="space-y-4 flex-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                O que está incluído
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-sm text-foreground/80">
                  <Check className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" />{" "}
                  Até 3 utilizadores
                </li>
                <li className="flex items-start gap-3 text-sm text-foreground/80">
                  <Check className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" />{" "}
                  Emissão de faturas (limite 500/mês)
                </li>
                <li className="flex items-start gap-3 text-sm text-foreground/80">
                  <Check className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" />{" "}
                  Gestão Financeira básica
                </li>
                <li className="flex items-start gap-3 text-sm text-foreground/80">
                  <Check className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" />{" "}
                  Suporte por email
                </li>
              </ul>
            </div>
          </div>

          {/* Plano 2: Profissional */}
          <div className="pricing-card relative flex flex-col p-8 rounded-3xl border border-brand-500/50 bg-gradient-to-b from-card to-brand-950/20 shadow-[0_0_40px_rgba(20,184,166,0.1)] transform md:-translate-y-4 transition-all duration-500 h-full z-10 group hover:border-brand-500 hover:shadow-[0_20px_60px_-15px_rgba(20,184,166,0.3)] hover:md:-translate-y-6">
            <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-brand-500 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-700 origin-left"></div>
            </div>

            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-brand-500 text-black text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full z-20 shadow-lg">
              Mais Popular
            </div>

            <h4 className="text-xl font-medium text-foreground mb-2 mt-2">
              Profissional
            </h4>
            <p className="text-muted-foreground text-sm mb-6 h-10">
              Para negócios em crescimento estruturado que precisam de
              automação.
            </p>
            <div className="mb-8">
              <span className="text-5xl font-bold text-foreground">
                €<span className="price-value">{isAnnual ? "79" : "99"}</span>
              </span>
              <span className="text-muted-foreground text-sm">/mês</span>
            </div>
            <button className="w-full py-3 px-4 rounded-full bg-white text-black hover:bg-gray-200 transition-colors font-semibold mb-8">
              Testar Profissional Grátis
            </button>
            <div className="space-y-4 flex-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Tudo do Essencial, mais:
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-sm text-foreground/80">
                  <Check className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" />{" "}
                  Utilizadores ilimitados
                </li>
                <li className="flex items-start gap-3 text-sm text-foreground/80">
                  <Check className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" />{" "}
                  Faturação e Stock ilimitados
                </li>
                <li className="flex items-start gap-3 text-sm text-foreground/80">
                  <Check className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" />{" "}
                  Acesso total à API Aberta
                </li>
                <li className="flex items-start gap-3 text-sm text-foreground/80">
                  <Check className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" />{" "}
                  Dashboards B.I. Avançados
                </li>
                <li className="flex items-start gap-3 text-sm text-foreground/80">
                  <Check className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" />{" "}
                  Suporte Prioritário (Chat 24/7)
                </li>
              </ul>
            </div>
          </div>

          {/* Plano 3: Enterprise */}
          <div className="pricing-card relative flex flex-col p-8 rounded-3xl border border-border bg-gradient-to-b from-card to-secondary transition-all duration-500 h-full group hover:border-border hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_20px_40px_-15px_rgba(255,255,255,0.05)]">
            <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-white/20 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-700 origin-left"></div>
            </div>

            <h4 className="text-xl font-medium text-foreground mb-2">
              Enterprise
            </h4>
            <p className="text-muted-foreground text-sm mb-6 h-10">
              Para corporações com necessidades de compliance e arquitetura
              dedicada.
            </p>
            <div className="mb-8">
              <span className="text-4xl font-bold text-foreground">Custom</span>
            </div>
            <button className="w-full py-3 px-4 rounded-full border border-border text-foreground hover:bg-muted transition-colors font-medium mb-8">
              Falar com Consultor
            </button>
            <div className="space-y-4 flex-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Tudo do Profissional, mais:
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-sm text-foreground/80">
                  <Check className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" />{" "}
                  Servidor Dedicado em Cloud Privada
                </li>
                <li className="flex items-start gap-3 text-sm text-foreground/80">
                  <Check className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" />{" "}
                  SLA com Garantia de 99.99%
                </li>
                <li className="flex items-start gap-3 text-sm text-foreground/80">
                  <Check className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" />{" "}
                  Account Manager (CS) Dedicado
                </li>
                <li className="flex items-start gap-3 text-sm text-foreground/80">
                  <Check className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" />{" "}
                  Onboarding in-loco pela nossa equipa
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
