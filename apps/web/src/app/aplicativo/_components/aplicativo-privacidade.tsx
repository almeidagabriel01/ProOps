"use client";

import React from "react";

import { LiquidGlass } from "@/components/marketing/_shared/liquid-glass";

const LINHAS = [
  { rotulo: "Sobra até o fim do mês", valor: "R$ 1.284,90", destaque: true },
  { rotulo: "Fatura do cartão", valor: "R$ 2.140,00" },
  { rotulo: "Mercado, ontem", valor: "R$ 45,00" },
  { rotulo: "Meta: reserva", valor: "R$ 7.500,00" },
];

const OCULTO = "••••••";

/**
 * The one claim on this page that is better demonstrated than described.
 *
 * Hiding values in a finance app is a feature everyone ships and most ship
 * badly: they mask the balance on the first screen and leak it on the third.
 * So the page hides its own numbers, all of them, from one control, and the
 * visitor can prove it in a click.
 *
 * `aria-pressed` carries the state, and the masked figures keep an accessible
 * label, so someone on a screen reader is told the values are hidden rather
 * than being read a row of bullets.
 */
export function AplicativoPrivacidade() {
  const [oculto, setOculto] = React.useState(false);

  return (
    <section className="border-t border-white/[0.06] bg-[var(--app-bg)] px-6 py-28 text-[var(--app-text)] md:px-10 md:py-36">
      <div className="mx-auto grid max-w-5xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="mb-4 inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--app-tint)]">
            <span className="h-px w-7 bg-[var(--app-tint)]/50" />
            Privacidade
          </p>

          <h2 className="[font-family:var(--font-hanken)] text-3xl font-bold leading-[1.1] tracking-[-0.02em] md:text-5xl">
            Esconder esconde em todas as telas.
          </h2>

          <p className="mt-6 max-w-md text-base leading-relaxed text-[var(--app-text-muted)]">
            Não só na primeira. Um toque e os valores somem do aplicativo
            inteiro, e continuam sumidos quando você volta. Experimente aqui do
            lado.
          </p>

          <button
            type="button"
            onClick={() => setOculto((atual) => !atual)}
            aria-pressed={oculto}
            className="mt-9 inline-flex items-center gap-3 rounded-full border border-[var(--app-card-border)] bg-[var(--app-element)] px-5 py-3 text-sm font-semibold text-[var(--app-text)] transition-colors hover:bg-[var(--app-selected)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-tint)]/60"
          >
            <span
              aria-hidden="true"
              className={`grid h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
                oculto ? "bg-[var(--app-tint)]" : "bg-white/15"
              }`}
            >
              <span
                className={`h-4 w-4 rounded-full bg-white transition-transform ${
                  oculto ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </span>
            {oculto ? "Mostrar valores" : "Esconder valores"}
          </button>
        </div>

        <LiquidGlass className="rounded-3xl p-6 md:p-8" delaySeconds={4}>
          <ul className="divide-y divide-white/[0.08]">
            {LINHAS.map((linha) => (
              <li
                key={linha.rotulo}
                className="flex items-baseline justify-between gap-4 py-4 first:pt-0 last:pb-0"
              >
                <span className="text-sm text-[var(--app-text-muted)]">
                  {linha.rotulo}
                </span>
                <span
                  className={`[font-family:var(--font-jetbrains-mono)] tabular-nums ${
                    linha.destaque
                      ? "text-lg font-semibold text-[var(--app-tint)] md:text-xl"
                      : "text-sm font-medium text-[var(--app-text)]"
                  }`}
                >
                  {oculto ? (
                    <span aria-label="valor oculto">{OCULTO}</span>
                  ) : (
                    linha.valor
                  )}
                </span>
              </li>
            ))}
          </ul>
        </LiquidGlass>
      </div>
    </section>
  );
}
