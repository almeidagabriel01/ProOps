"use client";

import React from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import { LiquidGlass } from "@/components/marketing/_shared/liquid-glass";
import { SCENE_ANY_WIDTH } from "@/components/marketing/_shared/use-scroll-scene";

import { DeviceFrame } from "./device-frame";

/**
 * The product's core promise, rebuilt in HTML so it can move.
 *
 * This is the app's Hoje screen, and the card that lands on it is a real
 * feature: the app shows the last entry the assistant created, quoting the
 * message it came from. Colours come from `.app-theme`, which is the app's own
 * `theme.ts`, and the numbers are set in the same mono the app uses.
 *
 * Rebuilt rather than screenshotted because a PNG cannot show the message
 * arriving, which is the entire point, and because at this size a screenshot
 * of a 3x phone weighs more than the markup.
 *
 * The screen is authored in its FINAL state and animated with `fromTo`. Under
 * reduced motion nothing is registered and the visitor simply sees the card
 * already sitting there, message and entry both readable, which still tells
 * the story.
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
          { y: 26, opacity: 0, scale: 0.97 },
          { y: 0, opacity: 1, scale: 1, duration: 0.85 },
        )
          .fromTo(
            ".capture-quote",
            { opacity: 0, y: 8 },
            { opacity: 1, y: 0, duration: 0.5 },
            "-=0.45",
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
        <div className="flex h-full flex-col px-5 pb-3">
          {/* Status bar. Sits beside the island, as on the device. */}
          <div className="flex items-center justify-between pb-1 pt-[3.2%]">
            <span className="[font-family:var(--font-jetbrains-mono)] text-[11px] font-medium text-[var(--app-text)]">
              9:41
            </span>
            <span
              aria-hidden="true"
              className="h-1.5 w-8 rounded-full bg-white/20"
            />
          </div>

          <p className="mt-3 [font-family:var(--font-hanken)] text-[15px] font-semibold text-[var(--app-text)]">
            Boa tarde
          </p>

          {/* The highlight panel: the app leads on what is LEFT, not on the
              balance. Dark in both of the app's themes, by design. */}
          <div className="mt-3 rounded-2xl bg-[linear-gradient(to_bottom,var(--app-hero-top),var(--app-hero-bottom))] p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--app-on-hero-muted)]">
              Sobra até o fim do mês
            </p>
            <p className="mt-1.5 [font-family:var(--font-jetbrains-mono)] text-[26px] font-semibold tracking-tight text-[var(--app-tint)]">
              R$ 1.284,90
            </p>
            <div
              aria-hidden="true"
              className="mt-3 flex h-8 items-end gap-[3px]"
            >
              {[38, 52, 44, 61, 49, 70, 58, 76, 66, 82, 74, 90].map(
                (height, index) => (
                  <span
                    key={index}
                    style={{ height: `${height}%` }}
                    className="flex-1 rounded-[2px] bg-[var(--app-tint)]/25"
                  />
                ),
              )}
            </div>
          </div>

          {/* The capture card, in the same glass the app is built from. */}
          <LiquidGlass
            className="capture-card mt-4 rounded-2xl p-4"
            delaySeconds={3.4}
          >
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--app-tint)]">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-[var(--app-tint)]"
              />
              Capturado no WhatsApp
            </p>

            <p className="capture-quote mt-2.5 [font-family:var(--font-hanken)] text-[13px] italic leading-snug text-[var(--app-text-muted)]">
              &ldquo;gastei 45 no mercado&rdquo;
            </p>

            <div className="capture-entry mt-3.5 flex items-center gap-3 border-t border-white/10 pt-3.5">
              <span
                aria-hidden="true"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--app-element)] text-sm"
              >
                🛒
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate [font-family:var(--font-hanken)] text-[13px] font-semibold text-[var(--app-text)]">
                  Mercado
                </span>
                <span className="block truncate text-[11px] text-[var(--app-text-muted)]">
                  Alimentação · Cartão
                </span>
              </span>
              <span className="capture-amount [font-family:var(--font-jetbrains-mono)] text-[14px] font-semibold text-[var(--app-text)]">
                R$ 45,00
              </span>
            </div>
          </LiquidGlass>

          {/* What is due, in the app's order of urgency. */}
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text-muted)]">
            Vencendo hoje
          </p>
          <ul className="mt-2.5 space-y-2">
            {[
              { titulo: "Fatura Nubank", meta: "Cartão", valor: "R$ 2.140,00" },
              { titulo: "Aluguel", meta: "Fixa", valor: "R$ 1.900,00" },
            ].map((item) => (
              <li
                key={item.titulo}
                className="flex items-center gap-3 rounded-xl bg-[var(--app-surface)] px-3 py-2.5"
              >
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--app-warning)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate [font-family:var(--font-hanken)] text-[12px] font-semibold text-[var(--app-text)]">
                    {item.titulo}
                  </span>
                  <span className="block text-[10px] text-[var(--app-text-muted)]">
                    {item.meta}
                  </span>
                </span>
                <span className="[font-family:var(--font-jetbrains-mono)] text-[12px] text-[var(--app-text)]">
                  {item.valor}
                </span>
              </li>
            ))}
          </ul>

          {/* The app's five tabs. Nothing says "this is the product" faster
              than its own navigation sitting where it always sits. */}
          <nav
            aria-hidden="true"
            className="-mx-5 mt-auto flex items-center justify-around border-t border-white/[0.07] bg-[var(--app-bg)] px-3 pb-1 pt-3"
          >
            {[
              { abrev: "Hoje", ativo: true },
              { abrev: "Financeiro", ativo: false },
              { abrev: "Notas", ativo: false },
              { abrev: "Agente", ativo: false },
              { abrev: "Perfil", ativo: false },
            ].map((aba) => (
              <span
                key={aba.abrev}
                className={`flex flex-col items-center gap-1 rounded-full px-2 py-1 ${
                  aba.ativo ? "bg-[var(--app-tint)]/15" : ""
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    aba.ativo
                      ? "bg-[var(--app-tint)]"
                      : "bg-[var(--app-text-muted)]/40"
                  }`}
                />
                <span
                  className={`text-[9px] ${
                    aba.ativo
                      ? "font-semibold text-[var(--app-tint)]"
                      : "text-[var(--app-text-muted)]/70"
                  }`}
                >
                  {aba.abrev}
                </span>
              </span>
            ))}
          </nav>
        </div>
      </DeviceFrame>
    </div>
  );
}
