"use client";

import React, { useEffect, useMemo, useRef } from "react";
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

type PricingCard = {
  name: string;
  description: string;
  features: string[];
  cta: string;
  popular: boolean;
  tier: string;
  prices: {
    monthly: number;
    yearly: number;
  };
};

const FALLBACK_PLANS: PricingCard[] = [
  {
    name: "Essencial",
    tier: "starter",
    description: "Para equipes pequenas validarem o processo comercial.",
    cta: "Começar agora",
    popular: false,
    prices: { monthly: 49, yearly: 470 },
    features: [
      "Gestão de propostas",
      "Cadastro de clientes e produtos",
      "Exportação de PDF",
      "Suporte por email",
    ],
  },
  {
    name: "Profissional",
    tier: "pro",
    description: "Plano recomendado para operação comercial em escala.",
    cta: "Solicitar demonstração",
    popular: true,
    prices: { monthly: 99, yearly: 950 },
    features: [
      "Tudo do Essencial",
      "Financeiro e carteiras",
      "CRM kanban",
      "Editor de PDF avançado",
      "Permissões de equipe",
    ],
  },
  {
    name: "Enterprise",
    tier: "enterprise",
    description: "Para empresas com fluxo, compliance e suporte dedicado.",
    cta: "Falar com consultor",
    popular: false,
    prices: { monthly: 0, yearly: 0 },
    features: [
      "Tudo do Profissional",
      "Acordo de SLA",
      "Acompanhamento de implantação",
      "Arquitetura dedicada",
    ],
  },
];

function formatPrice(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export function LandingPricing({
  plans,
  billingInterval = "monthly",
  setBillingInterval,
  isLoading,
}: LandingPricingProps) {
  const containerRef = useRef<HTMLElement>(null);
  const hasAnimatedPricesRef = useRef(false);
  const isAnnual = billingInterval === "yearly";

  const pricingCards = useMemo<PricingCard[]>(() => {
    if (!plans || plans.length === 0) {
      return FALLBACK_PLANS;
    }

    return plans.map((plan) => ({
      name: plan.name,
      tier: plan.tier,
      description: plan.description,
      features: plan.features,
      cta: plan.cta || "Assinar plano",
      popular: plan.popular,
      prices: plan.prices,
    }));
  }, [plans]);

  useGSAP(
    () => {
      const section = containerRef.current;
      if (!section) return;

      const headingItems =
        section.querySelectorAll<HTMLElement>(".pricing-heading-item");
      if (headingItems.length > 0) {
        headingItems.forEach((item) => {
          gsap.fromTo(
            item,
            { y: 28, opacity: 0, autoAlpha: 0 },
            {
              y: 0,
              opacity: 1,
              autoAlpha: 1,
              duration: 0.85,
              ease: "power2.out",
              scrollTrigger: {
                trigger: item,
                start: "top 92%",
                end: "bottom 14%",
                toggleActions: "restart none restart reset",
                invalidateOnRefresh: true,
              },
            },
          );
        });
      }

      const cards = section.querySelectorAll<HTMLElement>(".pricing-card");
      if (cards.length > 0) {
        cards.forEach((card) => {
          gsap.set(card, { y: 34, opacity: 0, autoAlpha: 0 });

          const cardTimeline = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: card,
              start: "top 94%",
              end: "top -34%",
              scrub: 0.8,
              invalidateOnRefresh: true,
            },
          });

          cardTimeline
            .to(card, {
              y: 0,
              opacity: 1,
              autoAlpha: 1,
              duration: 0.22,
            })
            .to(card, {
              y: 0,
              opacity: 1,
              autoAlpha: 1,
              duration: 0.5,
            })
            .to(card, {
              y: -20,
              opacity: 0,
              autoAlpha: 0,
              duration: 0.28,
            });
        });
      }
    },
    {
      scope: containerRef,
      dependencies: [isLoading, pricingCards.length],
      revertOnUpdate: true,
    },
  );

  useEffect(() => {
    if (!hasAnimatedPricesRef.current) {
      hasAnimatedPricesRef.current = true;
      return;
    }

    const priceElements = containerRef.current?.querySelectorAll<HTMLElement>(".price-value");
    if (!priceElements || priceElements.length === 0) {
      return;
    }

    priceElements.forEach((el) => {
      if (el.dataset.enterprise === "true") {
        return;
      }

      const monthly = Number(el.dataset.monthly || "0");
      const yearly = Number(el.dataset.yearly || "0");
      const startValue = isAnnual ? monthly : yearly;
      const endValue = isAnnual ? yearly : monthly;

      const state = { value: startValue };
      gsap.fromTo(
        el,
        { opacity: 0.6, y: 8 },
        { opacity: 1, y: 0, duration: 0.52, ease: "power2.out" },
      );

      gsap.to(state, {
        value: endValue,
        duration: 1.35,
        ease: "power2.inOut",
        onUpdate: () => {
          el.textContent = formatPrice(Math.round(state.value));
        },
      });
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
      className="py-28 relative border-y border-black/10 dark:border-white/10 bg-white dark:bg-neutral-950 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,0,0,0.045)_0,transparent_70%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.08)_0,transparent_70%)]" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-14">
          <h2 className="text-sm font-semibold text-black/65 dark:text-white/65 uppercase tracking-wider mb-3 pricing-heading-item">
            Planos ProOps
          </h2>
          <h3 className="text-4xl md:text-5xl font-bold mb-6 text-black dark:text-white pricing-heading-item">
            Evolua no ritmo da sua operação.
          </h3>
          <p className="text-black/65 dark:text-white/70 text-lg max-w-2xl mx-auto pricing-heading-item">
            Planos com recursos progressivos para você sair do básico e chegar
            em uma gestão integrada de ponta a ponta.
          </p>

          <div className="flex items-center justify-center gap-4 mt-10 pricing-heading-item">
            <span
              onClick={() => setBillingInterval && setBillingInterval("monthly")}
              className={`font-medium transition-colors duration-200 cursor-pointer ${
                !isAnnual ? "text-black dark:text-white" : "text-black/45 dark:text-white/45"
              }`}
            >
              Mensal
            </span>

            <button
              onClick={handleToggle}
              className="relative w-14 h-8 bg-black/10 dark:bg-white/15 border border-black/20 dark:border-white/20 rounded-full transition-colors duration-200 focus:outline-none flex items-center px-1 cursor-pointer"
              aria-label="Alternar período de cobrança"
            >
              <div
                className={`w-6 h-6 bg-black dark:bg-white rounded-full shadow-sm transform transition-transform duration-300 ${
                  isAnnual ? "translate-x-6" : ""
                }`}
              />
            </button>

            <span
              onClick={() => setBillingInterval && setBillingInterval("yearly")}
              className={`font-medium transition-colors duration-200 flex items-center gap-2 cursor-pointer ${
                isAnnual ? "text-black dark:text-white" : "text-black/45 dark:text-white/45"
              }`}
            >
              Anual
              <span className="text-[10px] bg-black/5 dark:bg-white/[0.08] border border-black/15 dark:border-white/15 text-black dark:text-white px-2 py-1 rounded-full uppercase tracking-wider font-bold">
                Economia
              </span>
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-[460px] rounded-3xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {pricingCards.map((plan) => {
              const rawPrice = plan.prices[isAnnual ? "yearly" : "monthly"];
              const monthlyPrice = plan.prices.monthly;
              const yearlyPrice = plan.prices.yearly;
              const isEnterprise =
                plan.tier.toLowerCase() === "enterprise" || rawPrice <= 0;
              const priceText = isEnterprise ? "Sob consulta" : formatPrice(rawPrice);
              const periodLabel = isEnterprise ? "" : isAnnual ? "/ano" : "/mês";

              return (
                <div
                  key={plan.name}
                  className={`pricing-card relative flex flex-col p-8 rounded-3xl border transition-all duration-300 h-full group ${
                    plan.popular
                      ? "border-black dark:border-white bg-black dark:bg-white text-white dark:text-black md:-translate-y-3 shadow-[0_22px_50px_rgba(0,0,0,0.22)] dark:shadow-[0_22px_50px_rgba(0,0,0,0.5)]"
                      : "border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 text-black dark:text-white hover:-translate-y-1 hover:shadow-[0_14px_32px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_14px_32px_rgba(0,0,0,0.45)]"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-white dark:bg-neutral-950 text-black dark:text-white text-xs font-bold uppercase tracking-[0.14em] px-4 py-1.5 rounded-full z-20">
                      Mais popular
                    </div>
                  )}

                  <h4 className="text-xl font-semibold mb-2 mt-1">{plan.name}</h4>
                  <p
                    className={`text-sm mb-6 min-h-10 ${
                      plan.popular
                        ? "text-white/75 dark:text-black/70"
                        : "text-black/60 dark:text-white/65"
                    }`}
                  >
                    {plan.description}
                  </p>

                  <div className="mb-8">
                    <span className="text-4xl font-bold">
                      <span
                        className="price-value"
                        data-monthly={monthlyPrice}
                        data-yearly={yearlyPrice}
                        data-enterprise={isEnterprise ? "true" : "false"}
                      >
                        {priceText}
                      </span>
                    </span>
                    {periodLabel && (
                      <span
                        className={`text-sm ml-1 ${
                          plan.popular
                            ? "text-white/75 dark:text-black/70"
                            : "text-black/55 dark:text-white/60"
                        }`}
                      >
                        {periodLabel}
                      </span>
                    )}
                  </div>

                  <button
                    className={`w-full py-3 px-4 rounded-full font-semibold mb-8 transition-colors ${
                      plan.popular
                        ? "bg-white dark:bg-neutral-950 text-black dark:text-white hover:bg-white/90 dark:hover:bg-neutral-900"
                        : "bg-black dark:bg-white text-white dark:text-black hover:bg-black/85 dark:hover:bg-white/90"
                    } cursor-pointer`}
                  >
                    {plan.cta}
                  </button>

                  <div className="space-y-4 flex-1">
                    <p
                      className={`text-xs font-semibold uppercase tracking-wider ${
                        plan.popular
                          ? "text-white/65 dark:text-black/60"
                          : "text-black/45 dark:text-white/55"
                      }`}
                    >
                      Recursos incluídos
                    </p>

                    <ul className="space-y-3">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className={`flex items-start gap-3 text-sm ${
                            plan.popular
                              ? "text-white/90 dark:text-black/90"
                              : "text-black/80 dark:text-white/80"
                          }`}
                        >
                          <Check
                            className={`w-4 h-4 mt-0.5 shrink-0 ${
                              plan.popular
                                ? "text-white dark:text-black"
                                : "text-black dark:text-white"
                            }`}
                          />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

