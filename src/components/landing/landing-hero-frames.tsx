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
      className="relative w-full h-[500vh] bg-white dark:bg-neutral-950"
    >
      <div
        className="sticky top-0 w-full h-screen flex items-center justify-center overflow-hidden"
        style={{ perspective: "1500px" }}
      >
        <motion.div
          style={{ opacity: gridOpacity }}
          className="absolute inset-0 z-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.04)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:40px_40px]"
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
          className="relative z-10 text-center flex flex-col items-center max-w-5xl px-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-black/15 dark:border-white/15 bg-white dark:bg-neutral-900 text-[11px] text-black/70 dark:text-white/70 mb-8 uppercase tracking-[0.18em] font-semibold">
            <ProOpsLogo
              variant="symbol"
              width={16}
              height={16}
              invertOnDark
              className="h-4 w-4"
            />
            Plataforma ProOps
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-[6.5rem] font-bold tracking-tight mb-6 leading-[0.92] text-black dark:text-white">
            <span className="block">Controle operacional</span>
            <span className="block text-black/55 dark:text-white/55">
              em tempo real.
            </span>
          </h1>

          <p className="text-base md:text-xl text-black/70 dark:text-white/70 max-w-3xl mx-auto mb-10 leading-relaxed">
            ProOps conecta dashboard, propostas, CRM, financeiro, carteiras,
            catálogo e editor de PDF em uma experiência única de gestão.
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
          className="absolute z-10 w-[92vw] md:w-[72vw] aspect-video rounded-2xl border border-black/15 dark:border-white/15 bg-white dark:bg-neutral-900 shadow-[0_35px_90px_rgba(0,0,0,0.15)] dark:shadow-[0_35px_90px_rgba(0,0,0,0.55)] overflow-hidden flex flex-col"
        >
          <div className="h-12 w-full border-b border-black/10 dark:border-white/10 flex items-center px-4 gap-2 bg-black/[0.015] dark:bg-white/[0.02]">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-black/10 dark:bg-white/10" />
              <div className="h-3 w-3 rounded-full bg-black/10 dark:bg-white/10" />
              <div className="h-3 w-3 rounded-full bg-black/10 dark:bg-white/10" />
            </div>
            <div className="ml-auto text-[10px] uppercase tracking-[0.18em] text-black/45 dark:text-white/45 font-mono">
              ProOps Suite
            </div>
          </div>

          <div className="flex-1 p-6 grid grid-cols-3 gap-6">
            <div className="col-span-2 flex flex-col gap-6">
              <motion.div
                style={{ opacity: feature1Opacity }}
                className="flex-1 rounded-xl border border-black/10 dark:border-white/10 flex flex-col justify-end relative overflow-hidden bg-white dark:bg-neutral-900"
              >
                <Image
                  src="/hero/PDF.png"
                  alt="Editor de PDF com proposta comercial em preview"
                  fill
                  className="object-cover object-left-top"
                  sizes="(max-width: 768px) 100vw, 60vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                <h3 className="relative z-10 [font-family:var(--font-pdf-montserrat)] text-[1.6rem] md:text-3xl font-semibold tracking-[-0.02em] text-white mb-2 px-6 drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)]">
                  Editor de PDF
                </h3>
                <p className="relative z-10 [font-family:var(--font-pdf-inter)] text-[15px] md:text-base leading-relaxed text-white/90 px-6 pb-6">
                  Capa personalizada, pré-visualização em tempo real e
                  exportação imediata.
                </p>
              </motion.div>
              <motion.div
                style={{ opacity: feature2Opacity }}
                className="h-32 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 flex items-center justify-center px-8 relative overflow-hidden"
              >
                <motion.div
                  style={{
                    width: useTransform(
                      smoothProgress,
                      [0.2, 0.4],
                      ["0%", "82%"],
                    ),
                  }}
                  className="h-2 bg-black dark:bg-white rounded-full"
                />
                <p className="absolute bottom-3 left-4 [font-family:var(--font-pdf-montserrat)] text-[11px] uppercase tracking-[0.16em] text-black/65 dark:text-white/65 font-semibold">
                  Pipeline operacional avançando
                </p>
              </motion.div>
            </div>

            <div className="col-span-1 flex flex-col gap-6">
              <motion.div
                style={{
                  opacity: feature2Opacity,
                  y: useTransform(smoothProgress, [0.25, 0.3], [40, 0]),
                }}
                className="h-48 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 p-5 relative overflow-hidden"
              >
                <div className="flex h-full w-full items-center justify-center">
                  <div className="relative h-24 w-24 rounded-full border-4 border-black/20 dark:border-white/20">
                    <div className="absolute inset-0 rounded-full border-4 border-black dark:border-white border-r-transparent border-b-transparent rotate-[-35deg]" />
                    <div className="absolute inset-4 rounded-full border border-black/20 dark:border-white/20" />
                  </div>
                </div>
                <p className="absolute top-4 left-4 [font-family:var(--font-pdf-montserrat)] text-[11px] uppercase tracking-[0.16em] text-black/55 dark:text-white/55 font-semibold">
                  Indicadores financeiros
                </p>
                <p className="absolute bottom-4 left-4 right-4 [font-family:var(--font-pdf-inter)] text-sm leading-relaxed text-black/70 dark:text-white/75 font-medium">
                  Visão consolidada de margem, carteira ativa e previsão.
                </p>
              </motion.div>

              <motion.div
                style={{
                  opacity: feature3Opacity,
                  x: useTransform(smoothProgress, [0.3, 0.35], [40, 0]),
                }}
                className="flex-1 rounded-xl border border-black/10 dark:border-white/10 relative overflow-hidden bg-white dark:bg-neutral-900"
              >
                <Image
                  src="/hero/Dashboard.png"
                  alt="Dashboard operacional com indicadores e fluxo de caixa"
                  fill
                  className="object-cover object-[62%_70%]"
                  sizes="(max-width: 768px) 100vw, 30vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent" />
                <h3 className="absolute bottom-12 left-4 right-4 [font-family:var(--font-pdf-montserrat)] text-xl md:text-2xl font-semibold tracking-[-0.02em] text-white mb-2 drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)]">
                  Dashboard operacional
                </h3>
                <p className="absolute bottom-4 left-4 right-4 [font-family:var(--font-pdf-inter)] text-[13px] md:text-sm leading-relaxed text-white/90">
                  Fluxo de caixa, projeção de saldo e alertas críticos em um
                  único painel.
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
          className="absolute z-20 w-[92vw] max-w-5xl aspect-[21/9] border border-black/15 dark:border-white/15 bg-white dark:bg-neutral-900 rounded-2xl shadow-[0_30px_100px_rgba(0,0,0,0.2)] dark:shadow-[0_30px_100px_rgba(0,0,0,0.55)] overflow-hidden flex flex-col"
        >
          <div className="h-12 border-b border-black/10 dark:border-white/10 flex items-center px-6 justify-between bg-black/[0.015] dark:bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <ProOpsLogo
                variant="symbol"
                width={18}
                height={18}
                invertOnDark
                className="h-[18px] w-[18px]"
              />
              <span className="text-[10px] uppercase tracking-[0.16em] text-black/50 dark:text-white/50 font-mono">
                ProOps_CRM
              </span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-black/40 dark:text-white/40 font-mono">
              proops.com.br
            </div>
          </div>

          <div className="flex-1 relative p-4 sm:p-5 md:p-6 bg-white dark:bg-neutral-900">
            <div className="w-full h-full overflow-hidden rounded-lg border border-black/10 dark:border-white/10 relative">
              <Image
                src="/hero/Kanban.png"
                alt="Kanban ProOps com pipeline operacional"
                fill
                className="object-cover object-center"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
              <p className="absolute bottom-4 left-4 right-4 [font-family:var(--font-pdf-inter)] text-[15px] md:text-base leading-relaxed text-white/90 font-medium">
                CRM comercial com etapas claras, prioridades e gargalos em tempo
                real.
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="absolute inset-0 bg-white dark:bg-neutral-950 pointer-events-none z-30"
          style={{ opacity: useTransform(smoothProgress, [0.95, 1], [0, 1]) }}
        />
      </div>
    </section>
  );
}
