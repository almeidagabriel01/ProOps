"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { ArrowRight, Cpu, Layers, MoveHorizontal } from "lucide-react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { Accent, SectionHeading } from "./_shared/section-heading";
import { MagneticButton } from "./_shared/magnetic-button";
import { usePauseOffscreen } from "./_shared/use-pause-offscreen";

type Niche = {
  index: string;
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  description: string;
  features: string[];
  href: string;
};

const NICHES: Niche[] = [
  {
    index: "01",
    icon: Cpu,
    eyebrow: "Pacote pronto",
    title: "Automação Residencial",
    description:
      "Gerencie projetos de automação com catálogo de produtos, sistemas por ambiente e propostas técnicas em PDF profissional.",
    features: ["Catálogo de produtos", "Sistemas por ambiente", "PDF técnico"],
    href: "/automacao-residencial",
  },
  {
    index: "02",
    icon: Layers,
    eyebrow: "Pacote pronto",
    title: "Decoração de Interiores",
    description:
      "Crie propostas com cálculo automático por m², largura ou altura. Catálogo de tecidos, persianas e papéis de parede integrado.",
    features: ["Cálculo por medidas", "Tecidos e persianas", "Orçamento automático"],
    href: "/decoracao",
  },
];

/* ===================================================================== */
/* Painéis                                                               */
/* ===================================================================== */

function IntroPanel() {
  return (
    <div className="flex h-full w-screen shrink-0 flex-col justify-center px-6 md:px-16 lg:px-24">
      <SectionHeading
        align="left"
        eyebrow="Especializado no seu segmento"
        title={
          <>
            Feito para o seu <Accent>nicho</Accent>
          </>
        }
        description="Pacotes prontos com catálogos e cálculos sob medida para cada operação."
      />
      <div className="mt-10 inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
        <MoveHorizontal className="h-4 w-4" />
        Role para percorrer os pacotes
      </div>
    </div>
  );
}

/** Lista de recursos com hairlines e hover: fill varrendo + índice + seta deslizando. */
function FeatureRows({ features }: { features: string[] }) {
  return (
    <ul className="mt-7 max-w-sm">
      {features.map((feature, i) => (
        <li
          key={feature}
          className="group/row relative flex items-center gap-5 border-t border-black/10 py-3.5 pl-4 last:border-b dark:border-white/10"
        >
          <span
            aria-hidden
            className="absolute left-0 top-1/2 h-0 w-px -translate-y-1/2 bg-black/55 transition-[height] duration-300 ease-out group-hover/row:h-2/3 motion-reduce:transition-none dark:bg-white/55"
          />
          <span className="tabular-nums text-xs text-black/35 transition-colors duration-300 group-hover/row:text-black/70 motion-reduce:transition-none dark:text-white/35 dark:group-hover/row:text-white/70">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className="text-sm font-medium text-black/75 transition-colors duration-300 group-hover/row:text-black motion-reduce:transition-none dark:text-white/75 dark:group-hover/row:text-white">
            {feature}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Numeral editorial: traço (stroke) com gradiente mono + brilho; sheen girando. */
function NicheIndex({
  value,
  animated,
  corner = false,
}: {
  value: string;
  animated: boolean;
  corner?: boolean;
}) {
  const id = `niche-grad-${value}`;
  const position = corner
    ? "-top-6 right-0 h-32"
    : "right-2 top-1/2 h-[42vh] -translate-y-1/2 md:right-12 md:h-[56vh]";
  return (
    <svg
      aria-hidden
      viewBox="0 0 150 110"
      fill="none"
      className={`pointer-events-none absolute w-auto select-none [filter:drop-shadow(0_8px_22px_rgba(0,0,0,0.12))] dark:[filter:drop-shadow(0_8px_24px_rgba(255,255,255,0.10))] ${position}`}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop
            offset="0"
            className="[stop-color:rgba(0,0,0,0.28)] dark:[stop-color:rgba(255,255,255,0.32)]"
          />
          <stop
            offset="0.5"
            className="[stop-color:rgba(0,0,0,0.92)] dark:[stop-color:rgba(255,255,255,0.92)]"
          />
          <stop
            offset="1"
            className="[stop-color:rgba(0,0,0,0.28)] dark:[stop-color:rgba(255,255,255,0.32)]"
          />
          {animated && (
            <animateTransform
              attributeName="gradientTransform"
              type="rotate"
              from="0 0.5 0.5"
              to="360 0.5 0.5"
              dur="8s"
              repeatCount="indefinite"
            />
          )}
        </linearGradient>
      </defs>
      <text
        x="75"
        y="56"
        textAnchor="middle"
        dominantBaseline="central"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="2"
        className="[font-family:var(--font-pdf-montserrat)] text-[96px] font-black"
      >
        {value}
      </text>
    </svg>
  );
}

function NichePanel({ niche, animated }: { niche: Niche; animated: boolean }) {
  const Icon = niche.icon;
  return (
    <div className="relative flex h-full w-screen shrink-0 items-center overflow-hidden px-6 md:px-16 lg:px-24">
      {/* índice editorial: traço de gradiente teal com brilho girando */}
      <NicheIndex value={niche.index} animated={animated} />

      <div className="relative max-w-xl">
        <div className="flex items-center gap-3">
          <Icon className="h-6 w-6 text-black dark:text-white" />
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/50 dark:text-white/50">
            {niche.eyebrow}
          </span>
        </div>

        <h3 className="mt-5 [font-family:var(--font-pdf-montserrat)] text-4xl font-bold leading-[1.06] tracking-tight text-black dark:text-white md:text-5xl">
          {niche.title}
        </h3>

        <p className="mt-4 text-base leading-relaxed text-black/60 dark:text-white/65 md:text-lg">
          {niche.description}
        </p>

        <FeatureRows features={niche.features} />

        <MagneticButton
          href={niche.href}
          variant="link"
          className="mt-8"
          trailingIcon={<ArrowRight className="h-4 w-4" />}
        >
          Saiba mais
        </MagneticButton>
      </div>
    </div>
  );
}

/* ===================================================================== */
/* Seção                                                                 */
/* ===================================================================== */

/**
 * Nichos — galeria de scroll horizontal pinado: o scroll vertical desliza painéis
 * de tela cheia lado a lado (intro + um por nicho), no estilo dos sites
 * ultramodernos. Cada conteúdo vive no seu painel (sem sobreposição). Translate X
 * único dirigido por `useScroll` + barra de progresso. Em prefers-reduced-motion
 * vira um empilhamento vertical normal.
 */
export function LandingNiches() {
  const reduce = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const { ref: stageRef, inView } = usePauseOffscreen<HTMLDivElement>();
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  });

  const panelCount = NICHES.length + 1; // intro + nichos
  const x = useTransform(
    scrollYProgress,
    [0, 1],
    ["0vw", `-${(panelCount - 1) * 100}vw`],
  );

  // ---- Fallback estático (movimento reduzido) ----
  if (reduce) {
    return (
      <section className="border-t border-black/10 bg-white px-6 py-24 dark:border-white/10 dark:bg-neutral-950">
        <div className="mx-auto max-w-6xl space-y-16">
          <div>
            <p className="mb-4 inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-black/55 dark:text-white/60">
              <span className="h-px w-6 bg-black/30 dark:bg-white/45" />
              Especializado no seu segmento
            </p>
            <h2 className="[font-family:var(--font-pdf-montserrat)] text-4xl font-bold tracking-tight text-black dark:text-white md:text-5xl">
              Feito para o seu <Accent>nicho</Accent>
            </h2>
          </div>
          {NICHES.map((niche) => (
            <NichePanelStatic key={niche.href} niche={niche} />
          ))}
          <NicheFooterCTA />
        </div>
      </section>
    );
  }

  // ---- Scroll horizontal ----
  return (
    <>
      <section
        ref={trackRef}
        className="relative border-t border-black/10 bg-white dark:border-white/10 dark:bg-neutral-950"
        style={{ height: `${panelCount * 100}vh` }}
      >
        <div ref={stageRef} className="sticky top-0 h-screen overflow-hidden">
          {/* grade de pontos sutil (estática) */}
          <div className="absolute inset-0 [background-image:radial-gradient(circle,rgba(0,0,0,0.06)_1px,transparent_1px)] [background-size:36px_36px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_82%)] dark:[background-image:radial-gradient(circle,rgba(255,255,255,0.07)_1px,transparent_1px)]" />

          <motion.div style={{ x }} className="flex h-full w-max">
            <IntroPanel />
            {NICHES.map((niche) => (
              <NichePanel key={niche.href} niche={niche} animated={inView} />
            ))}
          </motion.div>

          {/* barra de progresso */}
          <div className="absolute bottom-10 left-8 right-8 z-10 h-px bg-black/10 dark:bg-white/10 md:left-20 md:right-20 lg:left-28 lg:right-28">
            <motion.div
              style={{ scaleX: scrollYProgress }}
              className="h-px w-full origin-left bg-black dark:bg-white"
            />
          </div>
        </div>
      </section>

      <section className="border-t border-black/10 bg-white px-6 py-16 dark:border-white/10 dark:bg-neutral-950">
        <NicheFooterCTA />
      </section>
    </>
  );
}

function NichePanelStatic({ niche }: { niche: Niche }) {
  const Icon = niche.icon;
  return (
    <div className="relative overflow-hidden">
      <NicheIndex value={niche.index} animated={false} corner />
      <div className="relative">
        <div className="flex items-center gap-3">
          <Icon className="h-6 w-6 text-black dark:text-white" />
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/50 dark:text-white/50">
            {niche.eyebrow}
          </span>
        </div>
        <h3 className="mt-5 [font-family:var(--font-pdf-montserrat)] text-4xl font-bold tracking-tight text-black dark:text-white md:text-5xl">
          {niche.title}
        </h3>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-black/60 dark:text-white/65 md:text-lg">
          {niche.description}
        </p>
        <FeatureRows features={niche.features} />
        <Link
          href={niche.href}
          className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-black dark:text-white"
        >
          Saiba mais
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function NicheFooterCTA() {
  return (
    <div className="mx-auto max-w-xl text-center">
      <p className="mb-3 text-sm text-black/60 dark:text-white/60">
        Atua em outro segmento? O ProOps adapta-se ao seu nicho.
      </p>
      <MagneticButton
        href="/contato"
        variant="link"
        trailingIcon={<ArrowRight className="h-4 w-4" />}
      >
        Fale com a gente
      </MagneticButton>
    </div>
  );
}
