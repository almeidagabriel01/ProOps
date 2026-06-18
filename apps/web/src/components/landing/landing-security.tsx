"use client";

import React, { useRef } from "react";
import {
  Database,
  Lock,
  Server,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { Accent, SectionHeading } from "./_shared/section-heading";

type Pillar = {
  icon: LucideIcon;
  title: string;
  description: string;
  /** raio do anel no viewBox 0..200 e ângulo cardinal do nó */
  radius: number;
  angle: "top" | "right" | "bottom" | "left";
};

const PILLARS: Pillar[] = [
  {
    icon: ShieldCheck,
    title: "Conformidade com a LGPD",
    description:
      "Tratamento de dados pessoais conforme a Lei Geral de Proteção de Dados, com exclusão sob demanda.",
    radius: 84,
    angle: "top",
  },
  {
    icon: Lock,
    title: "Criptografia em trânsito e em repouso",
    description:
      "Conexões protegidas por TLS e dados sensíveis cifrados — inclusive integrações como o Google Agenda.",
    radius: 66,
    angle: "right",
  },
  {
    icon: Server,
    title: "Isolamento multi-tenant",
    description:
      "Cada empresa acessa apenas os próprios dados, com regras de segurança aplicadas em cada requisição.",
    radius: 48,
    angle: "bottom",
  },
  {
    icon: Database,
    title: "Backups e redundância",
    description:
      "Infraestrutura gerenciada com redundância e rotinas de backup para que nada se perca.",
    radius: 30,
    angle: "left",
  },
];

const SEG = 0.2;
const startOf = (i: number) => 0.08 + i * SEG;

/** Posição do nó (em %) a partir do raio (viewBox 0..200) e do ângulo cardinal. */
function nodePosition(radius: number, angle: Pillar["angle"]) {
  const off = radius / 2; // raio em % do container
  switch (angle) {
    case "top":
      return { top: `${50 - off}%`, left: "50%" };
    case "right":
      return { top: "50%", left: `${50 + off}%` };
    case "bottom":
      return { top: `${50 + off}%`, left: "50%" };
    case "left":
      return { top: "50%", left: `${50 - off}%` };
  }
}

/* ===================================================================== */
/* Anel que se desenha + nó (cadeado do pilar) que trava                 */
/* ===================================================================== */

function RingPath({
  pillar,
  index,
  progress,
  draw,
}: {
  pillar: Pillar;
  index: number;
  progress: MotionValue<number>;
  draw: boolean;
}) {
  const s = startOf(index);
  const offset = useTransform(progress, [s, s + 0.16], [1, 0]);
  return (
    <motion.circle
      cx={100}
      cy={100}
      r={pillar.radius}
      fill="none"
      strokeWidth={1}
      pathLength={1}
      strokeDasharray={1}
      strokeLinecap="round"
      transform="rotate(-90 100 100)"
      className="stroke-black/70 dark:stroke-white/70"
      style={{ strokeDashoffset: draw ? offset : 0 }}
    />
  );
}

function RingNode({
  pillar,
  index,
  progress,
  draw,
}: {
  pillar: Pillar;
  index: number;
  progress: MotionValue<number>;
  draw: boolean;
}) {
  const Icon = pillar.icon;
  const s = startOf(index);
  const scale = useTransform(progress, [s + 0.1, s + 0.2], [0.3, 1]);
  const opacity = useTransform(progress, [s + 0.1, s + 0.18], [0, 1]);
  const pos = nodePosition(pillar.radius, pillar.angle);
  return (
    <motion.span
      style={
        draw
          ? { ...pos, scale, opacity, x: "-50%", y: "-50%" }
          : { ...pos, x: "-50%", y: "-50%" }
      }
      className="absolute grid h-10 w-10 place-items-center rounded-full border border-black/10 bg-white text-black shadow-[0_8px_24px_-12px_rgba(0,0,0,0.4)] dark:border-white/15 dark:bg-neutral-900 dark:text-white"
    >
      <Icon className="h-5 w-5" />
    </motion.span>
  );
}

/* ===================================================================== */
/* Pilar revelado na coluna de texto                                     */
/* ===================================================================== */

function PillarReveal({
  pillar,
  index,
  progress,
  draw,
}: {
  pillar: Pillar;
  index: number;
  progress: MotionValue<number>;
  draw: boolean;
}) {
  const Icon = pillar.icon;
  const s = startOf(index);
  const opacity = useTransform(progress, [s, s + 0.12], [0.15, 1]);
  const x = useTransform(progress, [s, s + 0.12], [-22, 0]);
  const barScaleY = useTransform(progress, [s, s + 0.14], [0, 1]);
  return (
    <motion.div
      style={draw ? { opacity, x } : undefined}
      className="relative flex items-start gap-4 py-4 pl-5"
    >
      <motion.span
        aria-hidden
        style={draw ? { scaleY: barScaleY } : undefined}
        className="absolute left-0 top-3 h-[calc(100%-1.5rem)] w-px origin-top bg-black/60 dark:bg-white/60"
      />
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-black dark:text-white" />
      <div>
        <h3 className="font-semibold leading-snug text-black dark:text-white">
          {pillar.title}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-black/60 dark:text-white/60">
          {pillar.description}
        </p>
      </div>
    </motion.div>
  );
}

/* ===================================================================== */
/* Seção                                                                 */
/* ===================================================================== */

/**
 * Segurança — scrollytelling de "camadas de proteção": um núcleo central (seus
 * dados) é cercado por anéis que se desenham um a um conforme o scroll, cada anel
 * travando um nó (pilar) e revelando seu texto à esquerda. Tudo dirigido por
 * `useScroll` (strokeDashoffset + transforms — sem cards/badges, sem blur).
 * Em prefers-reduced-motion vira um layout estático com tudo visível.
 */
export function LandingSecurity() {
  const reduce = useReducedMotion();
  const draw = !reduce;
  const trackRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  });

  const corePulse = useTransform(scrollYProgress, [0, 0.5, 1], [1, 1.06, 1]);
  const sealOpacity = useTransform(scrollYProgress, [0.86, 0.96], [0, 1]);
  const hintOpacity = useTransform(scrollYProgress, [0, 0.05], [1, 0]);

  const Emblem = (
    <div className="relative aspect-square w-full max-w-[24rem]">
      <svg viewBox="0 0 200 200" fill="none" className="absolute inset-0 h-full w-full">
        {PILLARS.map((pillar, i) => (
          <RingPath
            key={pillar.title}
            pillar={pillar}
            index={i}
            progress={scrollYProgress}
            draw={draw}
          />
        ))}
      </svg>

      {PILLARS.map((pillar, i) => (
        <RingNode
          key={pillar.title}
          pillar={pillar}
          index={i}
          progress={scrollYProgress}
          draw={draw}
        />
      ))}

      {/* núcleo */}
      <motion.div
        style={draw ? { scale: corePulse } : undefined}
        className="absolute inset-[38%] grid place-items-center rounded-full border border-black/15 bg-black/[0.03] backdrop-blur-sm dark:border-white/15 dark:bg-white/[0.05]"
      >
        <div className="animate-pulse-slow absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.12),transparent_70%)] dark:bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.18),transparent_70%)]" />
        <ShieldCheck className="relative h-10 w-10 text-black dark:text-white" />
      </motion.div>

      {/* selo final */}
      <motion.span
        style={draw ? { opacity: sealOpacity } : undefined}
        className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-black/60 dark:text-white/60"
      >
        Tudo protegido
      </motion.span>
    </div>
  );

  // ---- Fallback estático ----
  if (reduce) {
    return (
      <section className="border-t border-black/10 bg-white px-6 py-24 dark:border-white/10 dark:bg-neutral-950">
        <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-2">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Segurança & privacidade"
              title={
                <>
                  Seus dados <Accent>protegidos</Accent> por padrão
                </>
              }
              description="Segurança não é um recurso à parte — é a base da plataforma. Veja como cuidamos das informações do seu negócio e dos seus clientes."
              className="mb-8"
            />
            <div className="border-y border-black/10 dark:border-white/10">
              {PILLARS.map((pillar, i) => (
                <PillarReveal
                  key={pillar.title}
                  pillar={pillar}
                  index={i}
                  progress={scrollYProgress}
                  draw={false}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-center">{Emblem}</div>
        </div>
      </section>
    );
  }

  // ---- Scrollytelling ----
  return (
    <section
      ref={trackRef}
      className="relative border-t border-black/10 bg-white dark:border-white/10 dark:bg-neutral-950"
      style={{ height: "320vh" }}
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* grade de pontos sutil */}
        <div className="absolute inset-0 [background-image:radial-gradient(circle,rgba(0,0,0,0.06)_1px,transparent_1px)] [background-size:36px_36px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_82%)] dark:[background-image:radial-gradient(circle,rgba(255,255,255,0.07)_1px,transparent_1px)]" />

        <div className="mx-auto grid h-full max-w-6xl items-center gap-12 px-6 lg:grid-cols-2 lg:gap-16">
          {/* coluna de texto */}
          <div>
            <SectionHeading
              align="left"
              eyebrow="Segurança & privacidade"
              title={
                <>
                  Seus dados <Accent>protegidos</Accent> por padrão
                </>
              }
              description="Segurança não é um recurso à parte — é a base da plataforma. Cada camada protege as informações do seu negócio e dos seus clientes."
              className="mb-8"
            />
            <div>
              {PILLARS.map((pillar, i) => (
                <PillarReveal
                  key={pillar.title}
                  pillar={pillar}
                  index={i}
                  progress={scrollYProgress}
                  draw={draw}
                />
              ))}
            </div>
          </div>

          {/* emblema de camadas */}
          <div className="flex justify-center">{Emblem}</div>
        </div>

        {/* dica de scroll */}
        <motion.div
          style={{ opacity: hintOpacity }}
          className="absolute bottom-16 left-1/2 z-10 -translate-x-1/2 text-xs font-medium uppercase tracking-[0.2em] text-black/45 dark:text-white/45"
        >
          Role para blindar
        </motion.div>
      </div>
    </section>
  );
}
