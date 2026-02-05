"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Check, ArrowRight, Sparkles } from "lucide-react";
import {
  AnimatedText,
  AnimatedGradientText,
} from "@/components/ui/animated-text";

import { BillingToggle } from "@/components/ui/billing-toggle";

interface Plan {
  name: string;
  description: string;
  features: string[];
  tier: string;
  cta: string;
  popular?: boolean;
  prices: {
    monthly: number;
    yearly: number;
  };
}

interface LandingPricingProps {
  plans: Plan[];
  billingInterval: "monthly" | "yearly";
  setBillingInterval: (interval: "monthly" | "yearly") => void;
  isLoading?: boolean;
}

export function LandingPricing({
  plans,
  billingInterval,
  setBillingInterval,
  isLoading = false,
}: LandingPricingProps) {
  return (
    <section
      id="pricing"
      className="py-16 md:py-24 px-4 bg-muted/30 relative overflow-hidden"
    >
      {/* Background Effects */}

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-12 md:mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-4 text-foreground">
              <AnimatedText text="Planos para todos os tamanhos" />
            </h2>
          </motion.div>
          <motion.p
            className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto px-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Escolha o plano ideal para sua empresa e comece a transformar sua
            gestão hoje mesmo.
          </motion.p>

          {/* Billing Interval Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-8"
          >
            <BillingToggle
              id="home-toggle"
              value={billingInterval}
              onChange={setBillingInterval}
            />
          </motion.div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-6 md:p-8 rounded-2xl border border-border bg-card flex flex-col h-full animate-pulse"
              >
                <div className="h-8 bg-muted rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-muted rounded w-3/4 mb-6"></div>
                <div className="h-10 bg-muted rounded w-1/3 mb-2"></div>
                <div className="h-4 bg-muted rounded w-1/4 mb-1"></div>
                <div className="space-y-3 mb-8 flex-grow mt-6">
                  {[1, 2, 3, 4, 5].map((j) => (
                    <div key={j} className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-muted rounded-full"></div>
                      <div className="h-4 bg-muted rounded w-2/3"></div>
                    </div>
                  ))}
                </div>
                <div className="h-12 bg-muted rounded-xl w-full mt-auto"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.15,
                  ease: [0.21, 0.47, 0.32, 0.98],
                }}
                whileHover={{
                  y: -8,
                  scale: 1.02,
                  transition: { duration: 0.2 },
                }}
                className={`relative p-6 md:p-8 rounded-2xl border flex flex-col h-full group/card ${
                  plan.popular
                    ? "border-primary bg-gradient-to-b from-primary/20 to-primary/5 shadow-xl shadow-primary/20 md:scale-105 hover:shadow-primary/40"
                    : "border-border bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10"
                } transition-all duration-300`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full shadow-md shadow-primary/30">
                      <Sparkles className="w-3 h-3" />
                      Mais Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-bold mb-2 text-foreground">
                    {plan.name.charAt(0).toUpperCase() + plan.name.slice(1)}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {plan.description}
                  </p>
                </div>

                <div className="mb-6">
                  {billingInterval === "yearly" && (
                    <div className="text-sm text-muted-foreground line-through mb-1">
                      R${(plan.prices.monthly * 12).toLocaleString("pt-BR")}/ano
                    </div>
                  )}
                  <span className="text-3xl md:text-4xl font-bold text-foreground">
                    <AnimatedGradientText>
                      R$
                      {billingInterval === "yearly"
                        ? plan.prices.yearly.toLocaleString("pt-BR")
                        : plan.prices.monthly.toLocaleString("pt-BR")}
                    </AnimatedGradientText>
                  </span>
                  <span className="text-muted-foreground">
                    {billingInterval === "yearly" ? "/ano" : "/mês"}
                  </span>
                  {billingInterval === "yearly" && (
                    <div className="text-sm text-emerald-500 mt-1">
                      Equivale a R$
                      {Math.round(plan.prices.yearly / 12).toLocaleString(
                        "pt-BR",
                      )}
                      /mês
                    </div>
                  )}
                </div>

                {/* Features list with flex-grow to push button to bottom */}
                <ul className="space-y-3 mb-8 flex-grow">
                  {plan.features.map(
                    (feature: string, featureIndex: number) => (
                      <motion.li
                        key={feature}
                        className="flex items-center gap-3"
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{
                          duration: 0.3,
                          delay: index * 0.15 + featureIndex * 0.05,
                        }}
                      >
                        <div
                          className={`p-1 rounded-full ${plan.popular ? "bg-primary/20" : "bg-muted dark:bg-primary/10"}`}
                        >
                          <Check className="w-4 h-4 text-primary shrink-0" />
                        </div>
                        <span className="text-sm text-foreground/80">
                          {feature}
                        </span>
                      </motion.li>
                    ),
                  )}
                </ul>

                {/* Button always at bottom */}
                <Link
                  href={`/subscribe?plan=${plan.tier}&interval=${billingInterval}`}
                  className="mt-auto"
                >
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="group w-full py-3.5 rounded-xl font-medium transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-primary/50"
                  >
                    <span>{plan.cta}</span>
                    <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </motion.button>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
