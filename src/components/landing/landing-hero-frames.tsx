"use client";

import React, { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";

export function LandingHeroFrames() {
  const containerRef = useRef<HTMLElement>(null);

  // We increase the height to 500vh to give enough scroll time for all 3 frames
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    damping: 20,
    stiffness: 100,
  });

  // ========== Frame 1: Text Animation ==========
  const textOpacity = useTransform(smoothProgress, [0, 0.1], [1, 0]);
  const textScale = useTransform(smoothProgress, [0, 0.1], [1, 0.9]);
  const textY = useTransform(smoothProgress, [0, 0.1], [0, -50]);

  // ========== Frame 2: UI Dashboard Mockup (Framer Motion snippet) ==========
  const uiRotateX = useTransform(smoothProgress, [0.1, 0.2], [45, 0]);
  const uiRotateZ = useTransform(smoothProgress, [0.1, 0.2], [-15, 0]);
  const uiTranslateY = useTransform(smoothProgress, [0.1, 0.2], [400, 0]);

  const uiScale = useTransform(
    smoothProgress,
    [0.1, 0.2, 0.45, 0.55],
    [0.6, 1, 1, 0], // shrinks out
  );
  const uiOpacity = useTransform(
    smoothProgress,
    [0.1, 0.15, 0.45, 0.55],
    [0, 1, 1, 0], // fades out
  );

  // Nested features opacities (Animates safely between 0.2 and 0.4, before UI fades out)
  const feature1Opacity = useTransform(smoothProgress, [0.2, 0.25], [0, 1]);
  const feature2Opacity = useTransform(smoothProgress, [0.25, 0.3], [0, 1]);
  const feature3Opacity = useTransform(smoothProgress, [0.3, 0.35], [0, 1]);

  // ========== Frame 3: NexERP Core Dashboard Image ==========
  // Enters precisely as Frame 2 exits (0.45 - 0.55). Stays solid, then zooms out (0.85 - 0.95).
  // Ensures animation completes strictly before 1.0 so container unpinning is seamless.
  const coreOpacity = useTransform(
    smoothProgress,
    [0.45, 0.55, 0.85, 0.95],
    [0, 1, 1, 0],
  );
  const coreScale = useTransform(smoothProgress, [0.45, 0.95], [0.5, 2.5]);
  const coreY = useTransform(smoothProgress, [0.45, 0.65], [100, 0]);
  const coreRotateX = useTransform(smoothProgress, [0.45, 0.65], [15, 0]);

  const gridOpacity = useTransform(smoothProgress, [0.85, 0.95], [0.2, 0]);

  return (
    <section
      ref={containerRef}
      className="relative w-full h-[500vh] bg-background"
    >
      <div
        className="sticky top-0 w-full h-screen flex items-center justify-center overflow-hidden"
        style={{ perspective: "1500px" }}
      >
        {/* Grid de fundo */}
        <motion.div
          style={{ opacity: gridOpacity }}
          className="absolute inset-0 z-0 grid-bg opacity-50 transform scale-110"
        ></motion.div>

        {/* Frame 1: Texto Inicial */}
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
          <div className="hero-badge inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-muted text-xs text-muted-foreground mb-8 uppercase tracking-[0.2em] font-medium animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
            O Padrão Ouro em SaaS
          </div>
          <h1 className="text-6xl md:text-8xl lg:text-[7rem] font-bold tracking-tighter mb-6 leading-[0.9] text-white animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150">
            <span className="block hero-title-line">Precisão em</span>
            <span className="block hero-title-line text-muted-foreground">
              cada detalhe.
            </span>
          </h1>
          <p className="hero-desc text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 font-light leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
            Um ERP despido de complexidade. Construído matematicamente para a
            performance e controlo absoluto da sua operação.
          </p>
          <div className="hero-line flex items-center justify-center gap-3 text-sm text-muted-foreground mt-12 opacity-60 animate-in fade-in zoom-in duration-1000 delay-500"></div>
        </motion.div>

        {/* Frame 2: The 3D Programmatic Frame Animation Alternative */}
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
          className="absolute z-10 w-[90vw] md:w-[70vw] aspect-video rounded-2xl border border-border bg-card/80 backdrop-blur-2xl shadow-2xl shadow-blue-900/20 overflow-hidden flex flex-col"
        >
          {/* Mock Dashboard Topbar */}
          <div className="h-12 w-full border-b border-border flex items-center px-4 gap-2">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-red-500/20" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/20" />
              <div className="h-3 w-3 rounded-full bg-green-500/20" />
            </div>
          </div>

          {/* Mock Dashboard Body layout to animate */}
          <div className="flex-1 p-6 grid grid-cols-3 gap-6">
            <div className="col-span-2 flex flex-col gap-6">
              <motion.div
                style={{ opacity: feature1Opacity }}
                className="flex-1 rounded-xl bg-gradient-to-br from-muted to-transparent border border-border p-6 flex flex-col justify-end relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 blur-[50px] rounded-full" />
                <h3 className="text-2xl font-bold text-white mb-2">
                  Painel Integrado
                </h3>
                <p className="text-neutral-400">
                  Visão panorâmica da saúde da sua empresa.
                </p>
              </motion.div>
              <div className="h-32 rounded-xl bg-muted border border-border flex items-center justify-center">
                <motion.div
                  style={{
                    width: useTransform(
                      smoothProgress,
                      [0.2, 0.4],
                      ["0%", "80%"],
                    ),
                  }}
                  className="h-2 bg-blue-500/50 rounded-full"
                />
              </div>
            </div>
            <div className="col-span-1 flex flex-col gap-6">
              <motion.div
                style={{
                  opacity: feature2Opacity,
                  y: useTransform(smoothProgress, [0.25, 0.3], [50, 0]),
                }}
                className="h-48 rounded-xl bg-muted border border-border p-6 flex items-center justify-center relative overflow-hidden group"
              >
                <div className="w-24 h-24 rounded-full border-4 border-dashed border-blue-500/30 animate-[spin_10s_linear_infinite]" />
                <div className="absolute font-bold text-blue-400 text-xl">
                  99%
                </div>
              </motion.div>
              <motion.div
                style={{
                  opacity: feature3Opacity,
                  x: useTransform(smoothProgress, [0.3, 0.35], [50, 0]),
                }}
                className="flex-1 rounded-xl bg-gradient-to-tl from-purple-500/10 to-transparent border border-border p-6"
              >
                <h3 className="text-lg font-bold text-white mb-2">
                  Automático
                </h3>
                <p className="text-sm text-neutral-400">
                  Processos que rodam sozinhos.
                </p>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Frame 3: O Núcleo do ERP (Dashboard Central) */}
        <motion.div
          id="mod-core"
          style={{
            opacity: coreOpacity,
            scale: coreScale,
            y: coreY,
            rotateX: coreRotateX,
            pointerEvents: useTransform(coreOpacity, (v) =>
              v > 0.5 ? "auto" : "none",
            ),
          }}
          className="absolute z-20 w-[90vw] max-w-4xl aspect-[21/9] border border-border bg-card rounded-2xl shadow-[0_30px_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
        >
          <div className="h-12 border-b border-border flex items-center px-6 justify-between bg-card">
            <div className="flex gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/20"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/20"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/20"></div>
            </div>
            <div className="text-[10px] text-muted-foreground font-mono tracking-[0.2em] uppercase">
              NexERP_Core
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center relative p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(15,23,42,0.08)_0,transparent_100%)] dark:bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08)_0,transparent_100%)]"></div>
            <div className="w-full h-full flex items-center justify-center">
              <Image
                src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop"
                alt="System Core"
                width={2070}
                height={1380}
                className="w-full h-full object-cover rounded"
              />
            </div>
          </div>
        </motion.div>

        {/* Global fade out when leaving the 500vh section */}
        <motion.div
          className="absolute inset-0 bg-background pointer-events-none z-30"
          style={{ opacity: useTransform(smoothProgress, [0.95, 1], [0, 1]) }}
        />
      </div>
    </section>
  );
}
