"use client";

import React from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import { LiquidGlass } from "@/components/marketing/_shared/liquid-glass";
import { SCENE_ANY_WIDTH } from "@/components/marketing/_shared/use-scroll-scene";

import { AppTabBar } from "./app-tab-bar";
import { DeviceFrame } from "./device-frame";

const CONTADORES = [
  { rotulo: "Vencendo", valor: "7" },
  { rotulo: "Lembretes", valor: "3" },
  { rotulo: "Orçamento", valor: "1" },
];

/**
 * The app's Hoje screen, rebuilt in HTML so the capture can arrive on it.
 *
 * Traced against the real screenshots in `public/mockup-ios`, because the two
 * sit on the same page and any drift between them reads as the mock being
 * fake. The details that were wrong before and matter: the header carries the
 * mark and the account avatar, the big figure in the panel is WHITE and the
 * green belongs to the projection line under it, the chart is an area line
 * rather than bars, the three counters sit below the panel, and the tab bar
 * floats as a pill with icons in the app's own order.
 *
 * The screen is authored in its FINAL state and animated with `fromTo`. Under
 * reduced motion nothing is registered and the capture card is simply already
 * there, message and entry both readable.
 */
export function AppCapturePhone() {
  const rootRef = React.useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(SCENE_ANY_WIDTH, () => {
        const tl = gsap.timeline({
          defaults: { ease: "expo.out" },
          delay: 0.9,
        });
        tl.fromTo(
          ".capture-card",
          { y: 24, opacity: 0, scale: 0.97 },
          { y: 0, opacity: 1, scale: 1, duration: 0.8 },
        )
          .fromTo(
            ".capture-quote",
            { opacity: 0, y: 8 },
            { opacity: 1, y: 0, duration: 0.5 },
            "-=0.4",
          )
          .fromTo(
            ".capture-entry",
            { opacity: 0, y: 10 },
            { opacity: 1, y: 0, duration: 0.55 },
            "-=0.2",
          )
          .fromTo(
            ".capture-amount",
            { opacity: 0, scale: 0.9 },
            { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(2)" },
            "-=0.3",
          );
      });
      return () => mm.revert();
    },
    { scope: rootRef },
  );

  return (
    <div ref={rootRef} className="relative mx-auto w-full max-w-[21rem]">
      <DeviceFrame platform="ios">
        <div className="flex h-full flex-col px-4 pb-3">
          <div className="flex items-center justify-between px-1 pb-1 pt-[3.4%]">
            <span className="[font-family:var(--font-jetbrains-mono)] text-[10px] font-semibold text-[var(--app-text)]">
              16:20
            </span>
            <span
              aria-hidden="true"
              className="h-2 w-6 rounded-[3px] border border-white/40"
            />
          </div>

          <div className="flex items-center justify-between border-b border-white/[0.06] px-1 pb-2.5 pt-2">
            <span
              aria-hidden="true"
              className="grid h-6 w-6 place-items-center rounded-full bg-white/[0.06] text-[10px] font-bold text-[var(--app-text)]"
            >
              P
            </span>
            <span
              aria-hidden="true"
              className="h-6 w-6 rounded-full bg-white/[0.08]"
            />
          </div>

          <p className="mt-3 px-1 [font-family:var(--font-hanken)] text-[15px] font-semibold text-[var(--app-text)]">
            Boa tarde, Gabriel
          </p>

          <div className="mt-3 rounded-2xl bg-[linear-gradient(to_bottom,var(--app-hero-top),var(--app-hero-bottom))] p-3.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
            <div className="flex items-start justify-between">
              <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--app-on-hero-muted)]">
                Sobra até o fim do mês
              </p>
              <span className="flex gap-1">
                <span
                  aria-hidden="true"
                  className="grid h-5 w-5 place-items-center rounded-full bg-white/[0.09] text-[9px] leading-none text-[var(--app-text)]"
                >
                  ...
                </span>
                <span
                  aria-hidden="true"
                  className="h-5 w-5 rounded-full bg-white/[0.09]"
                />
              </span>
            </div>

            <p className="mt-1 [font-family:var(--font-jetbrains-mono)] text-[24px] font-semibold tracking-tight text-[var(--app-text)]">
              R$ 1.284,90
            </p>
            <p className="mt-0.5 [font-family:var(--font-jetbrains-mono)] text-[9.5px] leading-snug text-[var(--app-tint)]">
              21 dias até virar o mês · Projeção positiva
            </p>

            <div className="mt-2.5 flex justify-between text-[8px] text-[var(--app-on-hero-muted)]">
              <span>Hoje</span>
              <span className="text-[var(--app-tint)]">
                R$ 1.284,90 projetado
              </span>
              <span>Dia 30</span>
            </div>

            <svg
              aria-hidden="true"
              viewBox="0 0 100 30"
              preserveAspectRatio="none"
              className="mt-1 h-10 w-full"
            >
              <defs>
                <linearGradient id="sobra-area" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--app-tint)"
                    stopOpacity="0.32"
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--app-tint)"
                    stopOpacity="0"
                  />
                </linearGradient>
              </defs>
              <path
                d="M0,3 L7,9 L16,9 L24,14 L40,16 L62,16 L80,16 L88,22 L100,23 L100,30 L0,30 Z"
                fill="url(#sobra-area)"
              />
              <path
                d="M0,3 L7,9 L16,9 L24,14 L40,16 L62,16 L80,16 L88,22 L100,23"
                fill="none"
                stroke="var(--app-tint)"
                strokeWidth="1.4"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>

          <div className="mt-2.5 grid grid-cols-3 gap-1.5">
            {CONTADORES.map((item) => (
              <div
                key={item.rotulo}
                className="rounded-xl bg-[var(--app-surface)] px-2.5 py-2"
              >
                <p className="text-[8.5px] text-[var(--app-text-muted)]">
                  {item.rotulo}
                </p>
                <p className="[font-family:var(--font-jetbrains-mono)] text-[15px] font-semibold text-[var(--app-warning)]">
                  {item.valor}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-3.5 px-1 text-[8.5px] font-semibold uppercase tracking-[0.14em] text-[var(--app-text-muted)]">
            Capturado no WhatsApp
          </p>

          <LiquidGlass
            className="capture-card mt-1.5 rounded-2xl p-3.5"
            delaySeconds={3.4}
          >
            <p className="capture-quote [font-family:var(--font-hanken)] text-[12px] italic leading-snug text-[var(--app-text-muted)]">
              &ldquo;gastei 45 no mercado&rdquo;
            </p>
            <div className="capture-entry mt-3 flex items-center gap-2.5 border-t border-white/10 pt-3">
              <span
                aria-hidden="true"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--app-element)] text-[13px]"
              >
                🛒
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate [font-family:var(--font-hanken)] text-[12px] font-semibold text-[var(--app-text)]">
                  Mercado
                </span>
                <span className="block truncate text-[10px] text-[var(--app-text-muted)]">
                  Alimentação · Cartão
                </span>
              </span>
              <span className="capture-amount [font-family:var(--font-jetbrains-mono)] text-[12.5px] font-semibold text-[var(--app-text)]">
                R$ 45,00
              </span>
            </div>
          </LiquidGlass>

          <AppTabBar />
        </div>
      </DeviceFrame>
    </div>
  );
}
