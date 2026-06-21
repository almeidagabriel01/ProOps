"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Check, CreditCard, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { LandingPlan } from "./use-landing-page";
import { Accent, SectionHeading } from "./_shared/section-heading";
import { LandingButton } from "./_shared/landing-button";
import { User } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { ApiError } from "@/lib/api-client";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface LandingPricingProps {
  plans?: LandingPlan[];
  currentUser?: User | null;
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

const ENTERPRISE_EXTRA_FEATURES = [
  "Consultoria dedicada",
  "WhatsApp integrado para consultas e envio de documentos",
];

const ENTERPRISE_CONTACT_EMAIL = "gestao@proops.com.br";

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
      "Consultoria dedicada",
      "WhatsApp integrado para consultas e envio de documentos",
      "Acordo de SLA",
      "Acompanhamento de implantação",
      "Arquitetura dedicada",
    ],
  },
];

/**
 * Card de plano mono premium: superfície com grade de pontos, brilho de topo,
 * borda em feixe cônico girando (`card-border-beam` — sempre no popular, no hover
 * nos demais), shine diagonal e spotlight branco seguindo o cursor. O popular é
 * invertido (escuro) para virar foco. Só vars CSS de ponteiro; degrada com
 * motion-reduce. Sem cor — preto/branco apenas.
 */
function PricingCard({
  popular,
  children,
}: {
  popular: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);

  // Spotlight follows the cursor via CSS vars. Coalesce the layout read +
  // write into a single rAF per frame so rapid pointermove events (60-120/s)
  // don't each force a synchronous reflow. Visually identical (one update per
  // animation frame); only the per-event layout thrash is removed.
  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || frameRef.current !== null) return;
    const { clientX, clientY } = e;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${clientX - r.left}px`);
      el.style.setProperty("--my", `${clientY - r.top}px`);
    });
  };

  return (
    <div
      ref={ref}
      onPointerMove={handleMove}
      className={cn(
        "card-shine-on-hover group/card relative h-full rounded-3xl border p-8",
        "transition-[border-color] duration-300 ease-out",
        popular
          ? "border-white/15 bg-neutral-950 text-white shadow-[0_34px_80px_-30px_rgba(0,0,0,0.65)] lg:scale-105 dark:bg-black"
          : "border-black/10 bg-white shadow-[0_18px_50px_-36px_rgba(0,0,0,0.5)] hover:border-black/25 dark:border-white/10 dark:bg-neutral-900/60 dark:hover:border-white/25",
      )}
    >
      {/* grade de pontos */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-3xl [background-size:26px_26px] [mask-image:radial-gradient(ellipse_at_50%_0%,black,transparent_75%)]",
          popular
            ? "[background-image:radial-gradient(circle,rgba(255,255,255,0.09)_1px,transparent_1px)]"
            : "[background-image:radial-gradient(circle,rgba(0,0,0,0.05)_1px,transparent_1px)] dark:[background-image:radial-gradient(circle,rgba(255,255,255,0.06)_1px,transparent_1px)]",
        )}
      />

      {/* brilho de topo */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent to-transparent",
          popular ? "via-white/50" : "via-black/20 dark:via-white/30",
        )}
      />

      {/* feixe cônico: sempre no popular, no hover nos demais */}
      <span
        aria-hidden
        className={cn(
          "card-border-beam",
          !popular &&
            "opacity-0 transition-opacity duration-500 group-hover/card:opacity-100",
        )}
      />

      {/* spotlight seguindo o cursor */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 transition-opacity duration-300 group-hover/card:opacity-100"
        style={{
          background: popular
            ? "radial-gradient(360px circle at var(--mx,50%) var(--my,50%), rgba(255,255,255,0.10), transparent 60%)"
            : "radial-gradient(360px circle at var(--mx,50%) var(--my,50%), rgba(120,120,120,0.16), transparent 60%)",
        }}
      />

      {/* efeito contínuo: luz varrendo o card em loop (só no popular) */}
      {popular && (
        <span
          aria-hidden
          className="animate-card-sheen pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.14] to-transparent"
        />
      )}

      <div className="relative z-10 flex h-full flex-col">{children}</div>
    </div>
  );
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function LandingPricing({
  plans,
  currentUser,
  billingInterval = "monthly",
  setBillingInterval,
  isLoading,
}: LandingPricingProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLElement>(null);
  const hasAnimatedPricesRef = useRef(false);
  const [processingTier, setProcessingTier] = React.useState<string | null>(
    null,
  );
  const isAnnual = billingInterval === "yearly";

  const handleSubscribe = async (planTier: string) => {
    if (planTier === "enterprise") {
      window.location.href = `mailto:${ENTERPRISE_CONTACT_EMAIL}`;
      return;
    }

    if (!currentUser) {
      const subscribeUrl = `/subscribe?plan=${planTier}&interval=${billingInterval}`;
      router.push(`/login?redirect=${encodeURIComponent(subscribeUrl)}&mode=register`);
      return;
    }

    if (currentUser.role !== "free") {
      router.push("/dashboard");
      return;
    }

    setProcessingTier(planTier);
    try {
      const { StripeService } = await import("@/services/stripe-service");
      const response = await StripeService.createCheckoutSession({
        userId: currentUser.id,
        planTier,
        billingInterval,
        origin: window.location.origin,
      });

      if (response.url) {
        window.location.href = response.url;
        return;
      }

      toast.error("Não foi possível iniciar o checkout. Tente novamente.");
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        (error.data as { code?: string } | undefined)?.code === "RECENT_CHECKOUT_IN_FLIGHT"
      ) {
        toast.error(
          "Você já tem um checkout aberto. Aguarde alguns instantes e tente novamente.",
        );
        return;
      }
      console.error("Landing checkout error:", error);
      toast.error("Erro ao iniciar checkout. Tente novamente.");
    } finally {
      setProcessingTier(null);
    }
  };

  const ensureEnterpriseFeatures = (card: PricingCard): PricingCard => {
    if (card.tier !== "enterprise") {
      return card;
    }

    const existing = new Set(
      card.features.map((feature) => feature.toLowerCase()),
    );
    const missing = ENTERPRISE_EXTRA_FEATURES.filter(
      (feature) => !existing.has(feature.toLowerCase()),
    );

    if (missing.length === 0) {
      return card;
    }

    return {
      ...card,
      features: [...card.features, ...missing],
    };
  };

  const pricingCards = useMemo<PricingCard[]>(() => {
    if (!plans || plans.length === 0) {
      return FALLBACK_PLANS.map(ensureEnterpriseFeatures);
    }

    return plans.map((plan) =>
      ensureEnterpriseFeatures({
        name: plan.name,
        tier: plan.tier,
        description: plan.description,
        features: plan.features,
        cta: plan.cta || "Assinar plano",
        popular: plan.popular,
        prices: plan.prices,
      }),
    );
  }, [plans]);

  useGSAP(
    () => {
      const section = containerRef.current;
      if (!section) return;

      const headingItems = section.querySelectorAll<HTMLElement>(
        ".pricing-heading-item",
      );
      if (headingItems.length > 0) {
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
      }

      const cards = section.querySelectorAll<HTMLElement>(".pricing-card");
      if (cards.length > 0) {
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

    const priceElements =
      containerRef.current?.querySelectorAll<HTMLElement>(".price-value");
    if (!priceElements || priceElements.length === 0) {
      return;
    }

    priceElements.forEach((el) => {
      if (el.dataset.enterprise === "true") {
        return;
      }

      const monthly = Number(el.dataset.monthly || "0");
      const annualMonthly = Number(el.dataset.annualMonthly || "0");
      const startValue = isAnnual ? monthly : annualMonthly;
      const endValue = isAnnual ? annualMonthly : monthly;

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
          el.textContent = formatPrice(state.value);
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
      className="py-28 relative border-t border-black/10 dark:border-white/10 bg-white dark:bg-neutral-950 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-14">
          <SectionHeading
            eyebrow="Planos ProOps"
            title={
              <>
                Evolua no ritmo da sua <Accent>operação</Accent>
              </>
            }
            description="Planos com recursos progressivos para você sair do básico e chegar em uma gestão integrada de ponta a ponta."
            className="pricing-heading-item"
          />

          <div className="flex items-center justify-center gap-4 mt-10 pricing-heading-item">
            <span
              onClick={() =>
                setBillingInterval && setBillingInterval("monthly")
              }
              className={`font-medium transition-colors duration-200 cursor-pointer ${
                !isAnnual
                  ? "text-black dark:text-white"
                  : "text-black/45 dark:text-white/45"
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
                isAnnual
                  ? "text-black dark:text-white"
                  : "text-black/45 dark:text-white/45"
              }`}
            >
              Anual
              <span className="text-[10px] bg-black/5 dark:bg-white/[0.08] border border-black/15 dark:border-white/15 text-black dark:text-white px-2 py-1 rounded-full uppercase tracking-wider font-bold">
                15% OFF
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
          <div className="group/row mx-auto flex max-w-6xl flex-col items-stretch gap-6 lg:flex-row lg:justify-center lg:gap-0 lg:px-2">
            {pricingCards.map((plan) => {
              const monthlyPrice = plan.prices.monthly;
              const yearlyPrice = plan.prices.yearly;
              const annualMonthlyPrice = yearlyPrice > 0 ? yearlyPrice / 12 : 0;
              const displayPrice = isAnnual ? annualMonthlyPrice : monthlyPrice;
              const isEnterprise =
                plan.tier.toLowerCase() === "enterprise" || displayPrice <= 0;
              const ctaLabel = isEnterprise ? "Entrar em contato" : plan.cta;
              // Planos são ações primárias (compra): popular em destaque (inverted),
              // demais em solid. Sem variante secundária aqui.
              const ctaVariant = plan.popular ? "inverted" : "solid";
              const priceText = isEnterprise
                ? "Sob consulta"
                : formatPrice(displayPrice);
              const periodLabel = isEnterprise ? "" : "/mês";

              const fg = plan.popular ? "text-white" : "text-black dark:text-white";
              const fgMuted = plan.popular
                ? "text-white/65"
                : "text-black/60 dark:text-white/65";
              const fgFaint = plan.popular
                ? "text-white/45"
                : "text-black/45 dark:text-white/50";
              const hairline = plan.popular
                ? "bg-white/15"
                : "bg-black/10 dark:bg-white/10";

              return (
                <div
                  key={plan.name}
                  className={cn(
                    "pricing-card relative",
                    plan.popular
                      ? "lg:z-20 lg:-mx-5 lg:w-[38%]"
                      : "lg:z-10 lg:w-[31%]",
                  )}
                >
                  <PricingCard popular={plan.popular}>
                    <div className="flex items-center justify-between gap-3">
                      <h4
                        className={cn(
                          "[font-family:var(--font-pdf-montserrat)] text-lg font-bold",
                          fg,
                        )}
                      >
                        {plan.name}
                      </h4>
                      {plan.popular && (
                        <span className="relative inline-flex items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full bg-white px-3 py-1 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-black">
                          <Sparkles className="h-3 w-3" />
                          Mais popular
                          <span
                            aria-hidden
                            className="animate-card-sheen absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-black/25 to-transparent"
                          />
                        </span>
                      )}
                    </div>

                    <p className={cn("mt-2 min-h-10 text-sm leading-relaxed", fgMuted)}>
                      {plan.description}
                    </p>

                    <div className="mt-6 flex items-end gap-1.5">
                      <span
                        className={cn(
                          "price-value [font-family:var(--font-pdf-montserrat)] text-5xl font-bold tracking-tight",
                          fg,
                        )}
                        data-monthly={monthlyPrice}
                        data-annual-monthly={annualMonthlyPrice}
                        data-enterprise={isEnterprise ? "true" : "false"}
                      >
                        {priceText}
                      </span>
                      {periodLabel && (
                        <span className={cn("mb-1.5 text-sm", fgMuted)}>
                          {periodLabel}
                        </span>
                      )}
                    </div>
                    {isAnnual && !isEnterprise && (
                      <p className={cn("mt-2 text-xs font-medium", fgMuted)}>
                        Em 12x no cartão • 15% de desconto no anual
                      </p>
                    )}

                    <LandingButton
                      variant={ctaVariant}
                      size="md"
                      fullWidth
                      className="mt-7"
                      onClick={() => void handleSubscribe(plan.tier)}
                      disabled={processingTier === plan.tier}
                    >
                      {processingTier === plan.tier
                        ? "Redirecionando..."
                        : ctaLabel}
                    </LandingButton>

                    <div className="mt-8 flex flex-1 flex-col">
                      <div className="mb-4 flex items-center gap-3">
                        <span
                          className={cn(
                            "text-[0.7rem] font-semibold uppercase tracking-[0.16em]",
                            fgFaint,
                          )}
                        >
                          Recursos incluídos
                        </span>
                        <span className={cn("h-px flex-1", hairline)} />
                      </div>
                      <ul className="space-y-3">
                        {plan.features.map((feature) => (
                          <li
                            key={feature}
                            className={cn(
                              "flex items-start gap-3 text-sm",
                              plan.popular
                                ? "text-white/85"
                                : "text-black/80 dark:text-white/80",
                            )}
                          >
                            <Check className={cn("mt-0.5 h-4 w-4 shrink-0", fg)} />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </PricingCard>
                </div>
              );
            })}
          </div>
        )}

        <div className="pricing-heading-item mx-auto mt-16 flex max-w-3xl flex-wrap items-center justify-center gap-x-7 gap-y-3 text-sm text-black/60 dark:text-white/65">
          <span className="inline-flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Pagamento por cartão
          </span>
          <span className="inline-flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Cancele quando quiser
          </span>
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Dados protegidos (LGPD)
          </span>
        </div>
      </div>
    </section>
  );
}
