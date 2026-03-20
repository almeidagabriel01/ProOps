"use client";

import React, { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { ProOpsLogo } from "@/components/branding/proops-logo";

export function LandingHeroFrames() {
  const containerRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    damping: 20,
    stiffness: 100,
  });

  const textOpacity = useTransform(smoothProgress, [0, 0.1], [1, 0]);
  const textScale = useTransform(smoothProgress, [0, 0.1], [1, 0.92]);
  const textY = useTransform(smoothProgress, [0, 0.1], [0, -40]);

  const uiRotateX = useTransform(smoothProgress, [0.1, 0.2], [38, 0]);
  const uiRotateZ = useTransform(smoothProgress, [0.1, 0.2], [-12, 0]);
  const uiTranslateY = useTransform(smoothProgress, [0.1, 0.2], [320, 0]);

  const uiScale = useTransform(
    smoothProgress,
    [0.1, 0.2, 0.45, 0.55],
    [0.7, 1, 1, 0],
  );
  const uiOpacity = useTransform(
    smoothProgress,
    [0.1, 0.15, 0.45, 0.55],
    [0, 1, 1, 0],
  );

  const feature1Opacity = useTransform(smoothProgress, [0.2, 0.25], [0, 1]);
  const feature2Opacity = useTransform(smoothProgress, [0.25, 0.3], [0, 1]);
  const feature3Opacity = useTransform(smoothProgress, [0.3, 0.35], [0, 1]);

  const coreOpacity = useTransform(
    smoothProgress,
    [0.45, 0.55, 0.85, 0.95],
    [0, 1, 1, 0],
  );
  const coreScale = useTransform(smoothProgress, [0.45, 0.95], [0.58, 2.3]);
  const coreY = useTransform(smoothProgress, [0.45, 0.65], [80, 0]);
  const coreRotateX = useTransform(smoothProgress, [0.45, 0.65], [12, 0]);

  const gridOpacity = useTransform(smoothProgress, [0.85, 0.95], [0.3, 0]);

  return (
    <section
      ref={containerRef}
      className="relative h-[500vh] w-full overflow-x-clip bg-white dark:bg-neutral-950"
    >
      <div
        className="sticky top-0 isolate flex h-screen w-full items-center justify-center overflow-hidden px-3 sm:px-4 md:px-6"
        style={{ perspective: "1500px" }}
      >
        <motion.div
          style={{ opacity: gridOpacity }}
          className="absolute inset-0 z-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.04)_1px,transparent_1px)] bg-[size:40px_40px] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)]"
        />

        <motion.div
          style={{
            opacity: textOpacity,
            scale: textScale,
            y: textY,
            pointerEvents: useTransform(textOpacity, (v) =>
              v > 0.5 ? "auto" : "none",
            ),
          }}
          className="relative z-10 flex max-w-5xl flex-col items-center px-6 text-center"
        >
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-black/15 bg-white px-4 py-2 text-[11px] font-semibold tracking-[0.18em] text-black/70 dark:border-white/15 dark:bg-neutral-900 dark:text-white/70">
            <ProOpsLogo
              variant="symbol"
              width={16}
              height={16}
              invertOnDark
              className="h-4 w-4"
            />
            ProOps • Sistema ERP para gestão de serviços
          </div>

          <h1 className="mb-6 text-5xl font-bold leading-[0.92] tracking-tight text-black dark:text-white md:text-7xl lg:text-[6.5rem]">
            <span className="block">ProOps para equipes</span>
            <span className="block text-black/55 dark:text-white/55">
              comerciais e operacionais.
            </span>
          </h1>

          <h2 className="text-2xl font-bold text-black/80 dark:text-white/80 md:text-3xl">
            ProOps - Sistema ERP para gestão de serviços
          </h2>

          <p className="mx-auto mb-10 max-w-3xl text-base leading-relaxed text-black/70 dark:text-white/70 md:text-xl">
            O ProOps é um sistema ERP para gestão de serviços utilizado por
            empresas e profissionais para gerenciar clientes, ordens de serviço,
            relatórios e operações diárias em uma plataforma online.
          </p>
        </motion.div>

        <motion.div
          style={{
            rotateX: uiRotateX,
            rotateZ: uiRotateZ,
            y: uiTranslateY,
            scale: uiScale,
            opacity: uiOpacity,
            pointerEvents: useTransform(uiOpacity, (v) =>
              v > 0.5 ? "auto" : "none",
            ),
          }}
          className="absolute z-10 flex aspect-[9/12] w-[94%] max-w-[1100px] flex-col overflow-hidden rounded-2xl border border-black/15 bg-white shadow-[0_35px_90px_rgba(0,0,0,0.15)] dark:border-white/15 dark:bg-neutral-900 dark:shadow-[0_35px_90px_rgba(0,0,0,0.55)] sm:aspect-video sm:w-[92%] md:aspect-video md:w-[72%]"
        >
          <div className="flex h-10 w-full items-center gap-2 border-b border-black/10 bg-black/[0.015] px-3 dark:border-white/10 dark:bg-white/[0.02] sm:h-12 sm:px-4">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-black/10 dark:bg-white/10" />
              <div className="h-3 w-3 rounded-full bg-black/10 dark:bg-white/10" />
              <div className="h-3 w-3 rounded-full bg-black/10 dark:bg-white/10" />
            </div>
            <div className="ml-auto max-w-[45%] truncate font-mono text-[9px] uppercase tracking-[0.1em] text-black/45 dark:text-white/45 sm:text-[10px] sm:tracking-[0.18em]">
              ProOps Suite
            </div>
          </div>

          <div className="grid flex-1 grid-cols-1 gap-3 p-3 sm:gap-4 sm:p-4 md:grid-cols-3 md:gap-6 md:p-6">
            <div className="flex flex-col gap-3 sm:gap-4 md:col-span-2 md:gap-6">
              <motion.div
                style={{ opacity: feature1Opacity }}
                className="relative flex flex-1 flex-col justify-end overflow-hidden rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-neutral-900"
              >
                <Image
                  src="/hero/PDF.png"
                  alt="Editor de PDF com proposta comercial em preview"
                  fill
                  className="object-cover object-left-top"
                  sizes="(max-width: 768px) 100vw, 60vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                <h3 className="relative z-10 mb-2 px-4 text-[1.15rem] font-semibold tracking-[-0.02em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)] [font-family:var(--font-pdf-montserrat)] sm:px-6 sm:text-[1.35rem] md:text-3xl">
                  Editor de PDF
                </h3>
                <p className="relative z-10 px-4 pb-4 text-[13px] leading-relaxed text-white/90 [font-family:var(--font-pdf-inter)] sm:px-6 sm:pb-6 sm:text-[14px] md:text-base">
                  Capa personalizada, pre-visualizacao em tempo real e
                  exportacao imediata.
                </p>
              </motion.div>

              <motion.div
                style={{ opacity: feature2Opacity }}
                className="relative flex h-24 items-center justify-center overflow-hidden rounded-xl border border-black/10 bg-black/[0.03] px-4 dark:border-white/10 dark:bg-white/[0.04] sm:h-28 sm:px-6 md:h-32 md:px-8"
              >
                <motion.div
                  style={{
                    width: useTransform(
                      smoothProgress,
                      [0.2, 0.4],
                      ["0%", "82%"],
                    ),
                  }}
                  className="h-2 rounded-full bg-black dark:bg-white"
                />
                <p className="absolute bottom-2 left-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-black/65 [font-family:var(--font-pdf-montserrat)] dark:text-white/65 sm:bottom-3 sm:left-4 sm:text-[11px] sm:tracking-[0.16em]">
                  Pipeline operacional avancando
                </p>
              </motion.div>
            </div>

            <div className="hidden flex-col gap-6 md:col-span-1 md:flex">
              <motion.div
                style={{
                  opacity: feature2Opacity,
                  y: useTransform(smoothProgress, [0.25, 0.3], [40, 0]),
                }}
                className="relative h-48 overflow-hidden rounded-xl border border-black/10 bg-black/[0.03] p-5 dark:border-white/10 dark:bg-white/[0.04]"
              >
                <div className="flex h-full w-full items-center justify-center">
                  <div className="relative h-24 w-24 rounded-full border-4 border-black/20 dark:border-white/20">
                    <div className="absolute inset-0 rotate-[-35deg] rounded-full border-4 border-black border-b-transparent border-r-transparent dark:border-white" />
                    <div className="absolute inset-4 rounded-full border border-black/20 dark:border-white/20" />
                  </div>
                </div>
                <p className="absolute left-4 top-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-black/55 [font-family:var(--font-pdf-montserrat)] dark:text-white/55">
                  Indicadores financeiros
                </p>
                <p className="absolute bottom-4 left-4 right-4 text-sm font-medium leading-relaxed text-black/70 [font-family:var(--font-pdf-inter)] dark:text-white/75">
                  Visao consolidada de margem, carteira ativa e previsao.
                </p>
              </motion.div>

              <motion.div
                style={{
                  opacity: feature3Opacity,
                  x: useTransform(smoothProgress, [0.3, 0.35], [40, 0]),
                }}
                className="relative flex-1 overflow-hidden rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-neutral-900"
              >
                <Image
                  src="/hero/Dashboard.png"
                  alt="Dashboard operacional com indicadores e fluxo de caixa"
                  fill
                  className="object-cover object-[62%_70%]"
                  sizes="(max-width: 768px) 100vw, 30vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent" />
                <h3 className="absolute bottom-12 left-4 right-4 mb-2 text-xl font-semibold tracking-[-0.02em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)] [font-family:var(--font-pdf-montserrat)] md:text-2xl">
                  Dashboard operacional
                </h3>
                <p className="absolute bottom-4 left-4 right-4 text-[13px] leading-relaxed text-white/90 [font-family:var(--font-pdf-inter)] md:text-sm">
                  Fluxo de caixa, projecao de saldo e alertas criticos em um
                  unico painel.
                </p>
              </motion.div>
            </div>
          </div>
        </motion.div>

        <motion.div
          style={{
            opacity: coreOpacity,
            scale: coreScale,
            y: coreY,
            rotateX: coreRotateX,
            pointerEvents: useTransform(coreOpacity, (v) =>
              v > 0.5 ? "auto" : "none",
            ),
          }}
          className="absolute z-20 flex aspect-[4/5] w-[94%] max-w-5xl flex-col overflow-hidden rounded-2xl border border-black/15 bg-white shadow-[0_30px_100px_rgba(0,0,0,0.2)] dark:border-white/15 dark:bg-neutral-900 dark:shadow-[0_30px_100px_rgba(0,0,0,0.55)] sm:aspect-[16/10] sm:w-[92%] md:aspect-[21/9] md:w-[88%]"
        >
          <div className="flex h-10 items-center justify-between border-b border-black/10 bg-black/[0.015] px-3 dark:border-white/10 dark:bg-white/[0.02] sm:h-12 sm:px-6">
            <div className="flex items-center gap-2">
              <ProOpsLogo
                variant="symbol"
                width={18}
                height={18}
                invertOnDark
                className="h-[18px] w-[18px]"
              />
              <span className="max-w-[110px] truncate font-mono text-[9px] uppercase tracking-[0.1em] text-black/50 dark:text-white/50 sm:max-w-none sm:text-[10px] sm:tracking-[0.16em]">
                ProOps_CRM
              </span>
            </div>
            <div className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-black/40 dark:text-white/40 sm:block">
              proops.com.br
            </div>
          </div>

          <div className="relative flex-1 bg-white p-4 dark:bg-neutral-900 sm:p-5 md:p-6">
            <div className="relative h-full w-full overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
              <Image
                src="/hero/Kanban.png"
                alt="Kanban ProOps com pipeline operacional"
                fill
                className="object-cover object-center"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
              <p className="absolute bottom-3 left-3 right-3 text-[13px] font-medium leading-relaxed text-white/90 [font-family:var(--font-pdf-inter)] sm:bottom-4 sm:left-4 sm:right-4 sm:text-[14px] md:text-base">
                CRM comercial com etapas claras, prioridades e gargalos em tempo
                real.
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="pointer-events-none absolute inset-0 z-30 bg-white dark:bg-neutral-950"
          style={{ opacity: useTransform(smoothProgress, [0.95, 1], [0, 1]) }}
        />
      </div>
    </section>
  );
}
