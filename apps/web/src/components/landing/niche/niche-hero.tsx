"use client";

import React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { AnimatedGradientText } from "@/components/ui/animated-text";
import type { User } from "@/types";
import { getAuthenticatedHome } from "@/lib/landing/auth-redirect";
import type { NicheLandingConfig } from "./types";

interface NicheHeroProps {
  hero: NicheLandingConfig["hero"];
  currentUser?: User | null;
  isAuthLoading?: boolean;
}

export function NicheHero({ hero, currentUser, isAuthLoading }: NicheHeroProps) {
  const appHref = currentUser ? getAuthenticatedHome(currentUser) : hero.primaryCta.href;
  const primaryLabel = currentUser ? "Acessar painel" : hero.primaryCta.label;
  const showSecondaryCta = !currentUser;

  return (
    <section className="relative overflow-hidden min-h-[100svh] flex flex-col items-center justify-center px-4 text-center pt-24 pb-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(0,0,0,0.04)_0%,transparent_100%)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(255,255,255,0.06)_0%,transparent_100%)]" />

      <div className="relative mx-auto max-w-4xl">
        {hero.eyebrow && (
          <motion.span
            initial={{ opacity: 0, y: -12, scale: 0.85, filter: "blur(8px)" }}
            whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            viewport={{ once: false, amount: 0.3 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="mb-5 inline-flex items-center rounded-full border border-black/10 bg-black/[0.03] px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-black/60 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60"
          >
            {hero.eyebrow}
          </motion.span>
        )}

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6 text-4xl font-bold tracking-tight text-black dark:text-white md:text-6xl"
        >
          {hero.title}{" "}
          <AnimatedGradientText>{hero.titleHighlight}</AnimatedGradientText>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-black/65 dark:text-white/65"
        >
          {hero.subtitle}
        </motion.p>

        {!isAuthLoading && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.3 }}
            transition={{ duration: 0.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Button asChild size="lg" className="btn-sweep rounded-full px-8 font-semibold bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200">
                <Link href={appHref}>{primaryLabel}</Link>
              </Button>
            </motion.div>

            {showSecondaryCta && (
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="btn-sweep rounded-full px-8 font-semibold border-black/20 text-black hover:bg-black/[0.04] dark:border-white/20 dark:text-white dark:hover:bg-white/[0.06]"
                >
                  <Link href={hero.secondaryCta.href}>{hero.secondaryCta.label}</Link>
                </Button>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </section>
  );
}
