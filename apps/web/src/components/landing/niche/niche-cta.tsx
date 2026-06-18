"use client";

import React from "react";
import { motion } from "motion/react";
import { LandingButton } from "../_shared/landing-button";
import type { NicheLandingConfig } from "./types";

interface NicheCtaProps {
  cta: NicheLandingConfig["cta"];
}

export function NicheCta({ cta }: NicheCtaProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.05 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="border-t border-black/10 bg-white py-24 px-4 dark:border-white/10 dark:bg-neutral-950"
    >
      <div className="mx-auto max-w-2xl text-center">
        <motion.h2
          initial={{ opacity: 0, scale: 0.92, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          viewport={{ once: false, amount: 0.4 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-4 text-4xl font-bold tracking-tight text-black dark:text-white md:text-5xl"
        >
          {cta.title}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, scale: 0.92, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          viewport={{ once: false, amount: 0.4 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10 text-lg leading-relaxed text-black/65 dark:text-white/65"
        >
          {cta.subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.92, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          viewport={{ once: false, amount: 0.4 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-wrap items-center justify-center gap-4"
        >
          <LandingButton href="/register" variant="solid" size="lg">
            Criar conta
          </LandingButton>

          <LandingButton href={cta.crossLink.href} variant="link">
            {cta.crossLink.label}
          </LandingButton>
        </motion.div>
      </div>
    </motion.section>
  );
}
