"use client";

import React from "react";
import gsap from "gsap";

import { LiquidGlass } from "@/components/marketing/_shared/liquid-glass";
import { PauseOffscreen } from "@/components/marketing/_shared/pause-offscreen";
import {
  SCENE_ANY_WIDTH,
  useScrollScene,
} from "@/components/marketing/_shared/use-scroll-scene";
import { APP_NAME } from "@/lib/site/app-brand";

const CANAIS = [
  {
    canal: "No WhatsApp",
    exemplo: "me lembra de pagar o aluguel todo dia 5",
    detalhe: "Texto ou áudio. O áudio é transcrito e vira lembrete.",
  },
  {
    canal: "Dentro do aplicativo",
    exemplo: "quanto gastei esse mês?",
    detalhe: "A mesma assistente, com as conversas separadas por canal.",
  },
];

/**
 * One assistant, two places.
 *
 * The point of the section is the quota strip at the end: the channels are
 * separate conversations but a single allowance, which is the thing people
 * assume works the other way round.
 */
export function AplicativoAgente() {
  const sectionRef = React.useRef<HTMLElement>(null);

  useScrollScene(
    sectionRef,
    () => {
      gsap.utils.toArray<HTMLElement>(".canal-card").forEach((card, index) => {
        gsap.fromTo(
          card,
          { y: 30, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.75,
            delay: index * 0.1,
            ease: "expo.out",
            scrollTrigger: { trigger: card, start: "top 88%", once: true },
          },
        );
      });
    },
    { query: SCENE_ANY_WIDTH },
  );

  return (
    <section
      ref={sectionRef}
      className="border-t border-white/[0.06] bg-[var(--app-bg)] px-6 py-28 text-[var(--app-text)] md:px-10 md:py-36"
    >
      <div className="mx-auto max-w-5xl">
        <p className="mb-4 inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--app-tint)]">
          <span className="h-px w-7 bg-[var(--app-tint)]/50" />
          Um agente, dois lugares
        </p>

        <h2 className="max-w-2xl [font-family:var(--font-hanken)] text-3xl font-bold leading-[1.1] tracking-[-0.02em] md:text-5xl">
          A mesma assistente, onde você já estiver.
        </h2>

        <PauseOffscreen className="mt-14 grid gap-4 md:mt-16 md:grid-cols-2">
          {CANAIS.map((item, index) => (
            <LiquidGlass
              key={item.canal}
              as="article"
              className="canal-card rounded-3xl p-7 md:p-8"
              delaySeconds={2 + index * 1.5}
            >
              <p className="[font-family:var(--font-hanken)] text-sm font-semibold uppercase tracking-[0.14em] text-[var(--app-text-muted)]">
                {item.canal}
              </p>
              <p className="mt-5 [font-family:var(--font-hanken)] text-xl font-medium italic leading-snug text-[var(--app-text)] md:text-2xl">
                &ldquo;{item.exemplo}&rdquo;
              </p>
              <p className="mt-5 text-sm leading-relaxed text-[var(--app-text-muted)]">
                {item.detalhe}
              </p>
            </LiquidGlass>
          ))}
        </PauseOffscreen>

        {/* The quota strip, copied from the app's own profile screen. */}
        <div className="canal-card mt-4 rounded-3xl border border-[var(--app-card-border)] bg-[var(--app-surface)] p-7 md:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <p className="[font-family:var(--font-hanken)] text-base font-semibold">
              Conversas separadas, cota única
            </p>
            <p className="[font-family:var(--font-jetbrains-mono)] text-sm text-[var(--app-text-muted)]">
              6/100 · 2 WhatsApp · 4 no app
            </p>
          </div>
          <div
            aria-hidden="true"
            className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--app-element)]"
          >
            <span className="block h-full w-[6%] rounded-full bg-[var(--app-tint)]" />
          </div>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--app-text-muted)]">
            O que você conversa no WhatsApp não se mistura com o que você
            conversa dentro da {APP_NAME}. O limite mensal, sim, é o mesmo para
            os dois.
          </p>
        </div>
      </div>
    </section>
  );
}
