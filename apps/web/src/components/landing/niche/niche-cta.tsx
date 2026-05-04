"use client";

import React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
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
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button asChild size="lg" className="btn-sweep rounded-full px-8 font-semibold bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200">
              <Link href="/register">Criar conta grátis</Link>
            </Button>
          </motion.div>

          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="btn-sweep rounded-full px-8 font-semibold border-black/20 text-black hover:bg-black/[0.04] dark:border-white/20 dark:text-white dark:hover:bg-white/[0.06]"
            >
              <Link href={cta.crossLink.href}>{cta.crossLink.label}</Link>
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </motion.section>
  );
}
