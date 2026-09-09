import React from "react";

import { LandingButton } from "@/components/landing/_shared/landing-button";

import { AppHeroPhone } from "./app-hero-phone";

/**
 * The app landing opens on the promise itself, not on a description of it.
 *
 * The copy sits left and the phone right, so the headline is the LCP element
 * and paints through `hero-enter` at first paint with no JavaScript. The phone
 * is the only client island above the fold, and it animates from a final state
 * that is already in the HTML.
 */
export function AplicativoHero() {
  return (
    <section className="relative overflow-hidden bg-[var(--app-bg)] px-6 pb-24 pt-32 text-[var(--app-text)] md:px-10 md:pb-32 md:pt-40">
      {/* A single soft light from behind the phone. The app's accent is the only
          colour on this page, so it is what glows. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[-10%] top-[-10%] h-[70vh] w-[70vh] rounded-full bg-[var(--app-tint)] opacity-[0.07] blur-[120px]"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
        <div>
          <p
            className="hero-enter mb-7 inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--app-tint)]"
            style={
              {
                "--hero-y": "-10px",
                "--hero-blur": "6px",
                "--hero-dur": "0.5s",
              } as React.CSSProperties
            }
          >
            <span className="h-px w-7 bg-[var(--app-tint)]/50" />
            Finanças pessoais
          </p>

          <h1
            className="hero-enter [font-family:var(--font-hanken)] text-4xl font-bold leading-[1.06] tracking-[-0.03em] md:text-6xl"
            style={
              {
                "--hero-y": "22px",
                "--hero-delay": "0.1s",
              } as React.CSSProperties
            }
          >
            Você manda uma mensagem.
            <br />
            <span className="text-[var(--app-tint)]">A IA organiza.</span>
          </h1>

          <p
            className="hero-enter mt-7 max-w-xl text-base leading-relaxed text-[var(--app-text-muted)] md:text-lg"
            style={
              {
                "--hero-y": "16px",
                "--hero-delay": "0.22s",
              } as React.CSSProperties
            }
          >
            Notas, lembretes e controle financeiro pessoal por linguagem
            natural. No WhatsApp ou dentro do aplicativo, por texto ou por
            áudio.
          </p>

          <div
            className="hero-enter mt-10 flex flex-col gap-4 sm:flex-row sm:items-center"
            style={
              {
                "--hero-y": "12px",
                "--hero-delay": "0.34s",
                "--hero-dur": "0.5s",
              } as React.CSSProperties
            }
          >
            <LandingButton href="#lista-de-espera" variant="inverted" size="lg">
              Quero ser avisado
            </LandingButton>
            <p className="text-sm text-[var(--app-text-muted)]">
              Em breve na App Store e no Google Play.
            </p>
          </div>
        </div>

        <div
          className="hero-enter"
          style={
            {
              "--hero-y": "26px",
              "--hero-delay": "0.3s",
              "--hero-dur": "0.8s",
            } as React.CSSProperties
          }
        >
          <AppHeroPhone />
        </div>
      </div>
    </section>
  );
}
