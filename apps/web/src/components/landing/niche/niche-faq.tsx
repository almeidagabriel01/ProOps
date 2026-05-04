"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { NicheLandingConfig } from "./types";

interface FaqItemProps {
  question: string;
  answer: string;
}

function FaqItem({ question, answer }: FaqItemProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white dark:border-white/10 dark:bg-neutral-900">
        <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between px-6 py-5 text-left font-semibold text-black transition-colors hover:bg-black/[0.02] dark:text-white dark:hover:bg-white/[0.04]">
          <span className="pr-4 text-base">{question}</span>
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="shrink-0 text-black/50 dark:text-white/50"
          >
            <ChevronDown className="h-5 w-5" />
          </motion.span>
        </CollapsibleTrigger>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="faq-content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="border-t border-black/[0.06] px-6 pb-5 pt-4 text-sm leading-relaxed text-black/65 dark:border-white/[0.06] dark:text-white/65">
                {answer}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Collapsible>
  );
}

interface NicheFaqProps {
  faq: NicheLandingConfig["faq"];
}

export function NicheFaq({ faq }: NicheFaqProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.05 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="border-t border-black/10 bg-black/[0.015] py-24 px-4 dark:border-white/10 dark:bg-white/[0.03]"
    >
      <div className="mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-12 text-center"
        >
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-black/70 dark:text-white/70">
            FAQ
          </h2>
          <h3 className="text-4xl font-bold text-black dark:text-white md:text-5xl">
            Perguntas frequentes
          </h3>
        </motion.div>

        <div className="space-y-3">
          {faq.map((item, index) => (
            <motion.div
              key={item.question}
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: false, amount: 0.3 }}
              transition={{
                duration: 0.4,
                delay: index * 0.07,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <FaqItem question={item.question} answer={item.answer} />
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
