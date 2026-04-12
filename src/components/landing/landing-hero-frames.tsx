"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  FileText,
  CalendarDays,
  DollarSign,
  Users,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────────────────────
   DATA
──────────────────────────────────────────────────────────────────────────── */

const WORDS = ["precisão", "velocidade", "controle", "clareza"];

const BENEFITS = [
  { text: "Tudo em uma só plataforma" },
  { text: "Acesso de qualquer dispositivo" },
  { text: "Sem planilhas e controles paralelos" },
  { text: "Suporte incluído em todos os planos" },
];

const FEED = [
  {
    Icon: CheckCircle2,
    color: "#14b8a6",
    bg: "rgba(20,184,166,0.1)",
    text: "Proposta #247 aprovada pelo cliente",
    tag: "Propostas",
  },
  {
    Icon: TrendingUp,
    color: "#6366f1",
    bg: "rgba(99,102,241,0.1)",
    text: "5 leads avançaram no pipeline",
    tag: "CRM",
  },
  {
    Icon: DollarSign,
    color: "#10b981",
    bg: "rgba(16,185,129,0.1)",
    text: "Receita do mês atingiu R$ 48.200",
    tag: "Financeiro",
  },
  {
    Icon: FileText,
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.1)",
    text: "PDF gerado e enviado em 3 segundos",
    tag: "Propostas",
  },
  {
    Icon: CalendarDays,
    color: "#ec4899",
    bg: "rgba(236,72,153,0.1)",
    text: "Evento criado na agenda da operação",
    tag: "Agenda",
  },
  {
    Icon: Users,
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.1)",
    text: "Novo cliente cadastrado no CRM",
    tag: "CRM",
  },
];

const FEATURE_CARDS = [
  {
    icon: Users,
    label: "CRM",
    desc: "Pipeline e funil de vendas com etapas personalizadas.",
    color: "#6366f1",
    bg: "rgba(99,102,241,0.08)",
    hoverBg: "rgba(99,102,241,0.14)",
  },
  {
    icon: FileText,
    label: "Propostas",
    desc: "Editor de PDF com capa, preview e envio automático.",
    color: "#14b8a6",
    bg: "rgba(20,184,166,0.08)",
    hoverBg: "rgba(20,184,166,0.13)",
  },
  {
    icon: DollarSign,
    label: "Financeiro",
    desc: "Fluxo de caixa, wallets e controle de receita.",
    color: "#f97316",
    bg: "rgba(249,115,22,0.08)",
    hoverBg: "rgba(249,115,22,0.13)",
  },
];

/* ────────────────────────────────────────────────────────────────────────────
   CONSTANTS
──────────────────────────────────────────────────────────────────────────── */

const ease = [0.22, 1, 0.36, 1] as const;
// navbar: pt-4 (16px) + h-16 (64px) = 80px
const NAV_HEIGHT = 80;
const FONT_SIZE = "clamp(2rem, 3vw, 2.75rem)";

/* ────────────────────────────────────────────────────────────────────────────
   ACTIVITY FEED
──────────────────────────────────────────────────────────────────────────── */

function ActivityFeed() {
  const [visible, setVisible] = useState([0, 1, 2]);

  useEffect(() => {
    const id = setInterval(() => {
      setVisible((v) => {
        const next = (v[v.length - 1] + 1) % FEED.length;
        return [...v.slice(1), next];
      });
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence mode="popLayout" initial={false}>
        {visible.map((idx) => {
          const item = FEED[idx % FEED.length];
          return (
            <motion.div
              key={`${idx}-${item.tag}`}
              layout
              initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
              transition={{ duration: 0.42, ease }}
              whileHover={{ scale: 1.015, transition: { duration: 0.2 } }}
              className="flex cursor-default items-center gap-3 rounded-xl border border-black/8 bg-black/[0.02] px-3.5 py-2.5 transition-colors duration-200 hover:border-black/14 hover:bg-black/[0.04] dark:border-white/8 dark:bg-white/[0.03] dark:hover:border-white/14 dark:hover:bg-white/[0.05] sm:gap-3.5 sm:px-4 sm:py-3"
            >
              <div
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg sm:h-8 sm:w-8"
                style={{ background: item.bg }}
              >
                <item.Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" style={{ color: item.color }} />
              </div>
              <span className="flex-1 text-[12px] text-black/65 dark:text-white/55 [font-family:var(--font-pdf-inter)] sm:text-[13px]">
                {item.text}
              </span>
              <span
                className="flex-shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] sm:px-2 sm:text-[10px] sm:tracking-[0.12em]"
                style={{ color: item.color, background: item.bg }}
              >
                {item.tag}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   ANIMATED HEADLINE
──────────────────────────────────────────────────────────────────────────── */

function AnimatedHeadline({ wordIdx }: { wordIdx: number }) {
  return (
    <h1 className="[font-family:var(--font-pdf-montserrat)]">
      <div className="overflow-hidden pb-1">
        <motion.div
          className="font-bold leading-[1.1] tracking-[-0.03em] text-black dark:text-white"
          style={{ fontSize: FONT_SIZE }}
          initial={{ y: "105%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.75, delay: 0.1, ease }}
        >
          Seu negócio,
        </motion.div>
      </div>

      <div className="overflow-hidden pb-1">
        <motion.div
          className="whitespace-nowrap font-bold leading-[1.1] tracking-[-0.03em] text-black dark:text-white"
          style={{ fontSize: FONT_SIZE }}
          initial={{ y: "105%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.75, delay: 0.2, ease }}
        >
          gerenciado com
        </motion.div>
      </div>

      <div className="overflow-hidden" style={{ paddingBottom: "0.12em" }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={wordIdx}
            className="font-bold leading-[1.1] tracking-[-0.03em] text-teal-500 dark:text-teal-400"
            style={{ fontSize: FONT_SIZE }}
            initial={{ y: "105%", opacity: 0 }}
            animate={{ y: "0%", opacity: 1 }}
            exit={{ y: "-105%", opacity: 0 }}
            transition={{ duration: 0.46, ease }}
          >
            {WORDS[wordIdx]}
          </motion.div>
        </AnimatePresence>
      </div>
    </h1>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
──────────────────────────────────────────────────────────────────────────── */

export function LandingHeroFrames() {
  const [wordIdx, setWordIdx] = useState(0);
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  useEffect(() => {
    const id = setInterval(
      () => setWordIdx((i) => (i + 1) % WORDS.length),
      4200,
    );
    return () => clearInterval(id);
  }, []);

  const fadeUp = (delay: number) => ({
    initial: { opacity: 0, y: 20 },
    animate: mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 },
    transition: { duration: 0.7, delay, ease },
  });

  return (
    <section className="relative overflow-hidden bg-white dark:bg-neutral-950">
      {/* Accent line top */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-500/35 to-transparent" />

      {/*
        pt = NAV_HEIGHT (80px) + breathing room (32px) = 112px ≈ pt-28
        pb = 16 = pb-16 so section fills viewport but content isn't cramped
      */}
      <div
        className="mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-5 pb-16 sm:px-6 xl:px-8"
        style={{ paddingTop: `${NAV_HEIGHT + 32}px` }}
      >
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16 xl:gap-24">

          {/* ── LEFT: typography ─────────────────────────────────────────── */}
          <div className="flex flex-col justify-center">

            {/* Headline */}
            <div className="mb-6 sm:mb-8">
              {mounted && <AnimatedHeadline wordIdx={wordIdx} />}
            </div>

            {/* Description */}
            <motion.p
              {...fadeUp(0.55)}
              className="mb-8 max-w-md text-sm leading-relaxed text-black/55 dark:text-white/50 [font-family:var(--font-pdf-inter)] sm:text-base md:text-[1.0625rem]"
            >
              CRM, propostas, financeiro e agenda integrados numa plataforma
              feita para empresas de serviço que querem crescer sem perder o
              controle.
            </motion.p>

            {/* CTAs */}
            <motion.div
              {...fadeUp(0.65)}
              className="mb-10 flex flex-wrap gap-3"
            >
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link
                  href="/register"
                  className="group inline-flex items-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-100 sm:px-7 sm:py-3.5"
                >
                  Começar gratuitamente
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
              </motion.div>

              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link
                  href="#modulos"
                  className="inline-flex items-center gap-2 rounded-full border border-black/15 px-6 py-3 text-sm font-semibold text-black/60 transition-all duration-200 hover:border-black/30 hover:text-black dark:border-white/15 dark:text-white/50 dark:hover:border-white/30 dark:hover:text-white sm:px-7 sm:py-3.5"
                >
                  Ver módulos
                </Link>
              </motion.div>
            </motion.div>

            {/* Benefits */}
            <motion.div {...fadeUp(0.75)}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5">
                {BENEFITS.map((b, i) => (
                  <motion.div
                    key={b.text}
                    className="flex cursor-default items-center gap-2.5 rounded-lg px-3 py-2 transition-colors duration-150 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                    whileHover={{ x: 3, transition: { duration: 0.2 } }}
                    initial={{ opacity: 0, x: -8 }}
                    animate={mounted ? { opacity: 1, x: 0 } : {}}
                    transition={{ duration: 0.5, delay: 0.8 + i * 0.07, ease }}
                  >
                    <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-teal-500/10">
                      <CheckCircle2 className="h-3 w-3 text-teal-500" />
                    </div>
                    <span className="text-[12.5px] text-black/55 dark:text-white/48 [font-family:var(--font-pdf-inter)] sm:text-[13px]">
                      {b.text}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* ── RIGHT: activity feed ──────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, x: 32 }}
            animate={mounted ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.9, delay: 0.35, ease }}
            className="flex flex-col justify-center"
          >
            {/* Section label */}
            <div className="mb-4 flex items-center gap-4">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/35 dark:text-white/30">
                Plataforma em ação
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-black/8 to-transparent dark:from-white/8" />
            </div>

            <ActivityFeed />

            {/* Separator */}
            <div className="my-6 h-px bg-gradient-to-r from-transparent via-black/8 to-transparent dark:via-white/8 sm:my-8" />

            {/* Feature cards */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {FEATURE_CARDS.map((card, i) => (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={mounted ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.55, delay: 0.65 + i * 0.1, ease }}
                  whileHover={{
                    boxShadow: `0 0 0 1.5px ${card.color}45, 0 6px 20px ${card.color}12`,
                    backgroundColor: card.hoverBg,
                    transition: { duration: 0.15 },
                  }}
                  whileTap={{ scale: 0.98 }}
                  className="group relative cursor-default overflow-hidden flex flex-col gap-2.5 rounded-xl border border-black/8 bg-black/[0.02] p-3 dark:border-white/8 dark:bg-white/[0.02] sm:gap-3 sm:p-4"
                  style={{ transition: "box-shadow 0.15s ease, background-color 0.15s ease" }}
                >
                  {/* Shimmer sweep on hover */}
                  <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.07] to-transparent transition-transform duration-300 ease-in-out group-hover:translate-x-full" />

                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-lg sm:h-8 sm:w-8"
                    style={{ background: card.bg }}
                  >
                    <card.icon
                      className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                      style={{ color: card.color }}
                    />
                  </div>
                  <div>
                    <div
                      className="text-[11px] font-bold tracking-tight text-black dark:text-white [font-family:var(--font-pdf-montserrat)] sm:text-xs"
                      style={{ color: card.color }}
                    >
                      {card.label}
                    </div>
                    <div className="mt-0.5 hidden text-[11px] leading-relaxed text-black/45 dark:text-white/38 [font-family:var(--font-pdf-inter)] sm:block">
                      {card.desc}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom separator */}
      <div className="mx-auto h-px w-full max-w-7xl bg-gradient-to-r from-transparent via-black/12 to-transparent dark:via-white/12" />
    </section>
  );
}
