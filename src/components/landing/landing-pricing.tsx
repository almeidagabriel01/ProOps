"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Check, ArrowRight, Sparkles } from "lucide-react";
import { AnimatedText, AnimatedGradientText } from "@/components/ui/animated-text";
import { ParticlesBackground } from "@/components/ui/particles-background";
import { BillingToggle } from "@/components/ui/billing-toggle";

interface LandingPricingProps {
    plans: any[];
    billingInterval: "monthly" | "yearly";
    setBillingInterval: (interval: "monthly" | "yearly") => void;
}

export function LandingPricing({ plans, billingInterval, setBillingInterval }: LandingPricingProps) {
    return (
        <section
            id="pricing"
            className="py-16 md:py-24 px-4 bg-neutral-900/50 relative overflow-hidden"
        >
            {/* Background Effects */}
            <ParticlesBackground count={30} />

            <div className="max-w-7xl mx-auto relative z-10">
                <div className="text-center mb-12 md:mb-16">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                    >
                        <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-4">
                            <AnimatedText text="Planos para todos os tamanhos" />
                        </h2>
                    </motion.div>
                    <motion.p
                        className="text-neutral-400 text-base md:text-lg max-w-2xl mx-auto px-4"
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
                            className={`relative p-6 md:p-8 rounded-2xl border flex flex-col h-full group/card ${plan.popular
                                ? "border-violet-500 bg-gradient-to-b from-violet-500/20 to-violet-500/5 shadow-xl shadow-violet-500/20 md:scale-105 hover:shadow-violet-500/40"
                                : "border-neutral-800 bg-neutral-900 hover:border-violet-500/50 hover:bg-neutral-900/80 hover:shadow-lg hover:shadow-violet-500/10"
                                } transition-all duration-300`}
                        >
                            {plan.popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <span className="inline-flex items-center gap-1.5 bg-violet-500 text-white text-xs font-medium px-3 py-1 rounded-full shadow-md shadow-violet-500/30">
                                        <Sparkles className="w-3 h-3" />
                                        Mais Popular
                                    </span>
                                </div>
                            )}

                            <div className="mb-6">
                                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                                <p className="text-neutral-400 text-sm">{plan.description}</p>
                            </div>

                            <div className="mb-6">
                                {billingInterval === "yearly" && (
                                    <div className="text-sm text-neutral-500 line-through mb-1">
                                        R${(plan.prices.monthly * 12).toLocaleString("pt-BR")}/ano
                                    </div>
                                )}
                                <span className="text-3xl md:text-4xl font-bold">
                                    <AnimatedGradientText>
                                        R$
                                        {billingInterval === "yearly"
                                            ? plan.prices.yearly.toLocaleString("pt-BR")
                                            : plan.prices.monthly.toLocaleString("pt-BR")}
                                    </AnimatedGradientText>
                                </span>
                                <span className="text-neutral-400">
                                    {billingInterval === "yearly" ? "/ano" : "/mês"}
                                </span>
                                {billingInterval === "yearly" && (
                                    <div className="text-sm text-emerald-400 mt-1">
                                        Equivale a R$
                                        {Math.round(plan.prices.yearly / 12).toLocaleString(
                                            "pt-BR"
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
                                                className={`p-1 rounded-full ${plan.popular ? "bg-violet-500/20" : "bg-neutral-800"}`}
                                            >
                                                <Check className="w-4 h-4 text-violet-500 shrink-0" />
                                            </div>
                                            <span className="text-sm text-neutral-300">
                                                {feature}
                                            </span>
                                        </motion.li>
                                    )
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
                                    className={`group w-full py-3.5 rounded-xl font-medium transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 ${plan.popular
                                        ? "bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50"
                                        : "bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-violet-500/30"
                                        }`}
                                >
                                    <span>{plan.cta}</span>
                                    <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                                </motion.button>
                            </Link>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
