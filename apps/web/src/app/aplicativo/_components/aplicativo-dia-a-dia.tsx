"use client";

import React from "react";
import Image from "next/image";
import gsap from "gsap";

import { useScrollScene } from "@/components/marketing/_shared/use-scroll-scene";
import { APP_NAME } from "@/lib/site/app-brand";

import { MOMENTOS, type Bolha } from "../_content/dia-a-dia";

/** One turn of the conversation, in the shape the app itself produces. */
function BolhaChat({ bolha }: { bolha: Bolha }) {
  if (bolha.alerta) {
    return (
      <div className="max-w-[88%] rounded-2xl border border-white/[0.08] bg-[var(--app-surface)]/90 p-4 shadow-[0_20px_44px_-22px_rgba(0,0,0,0.9)] backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[var(--app-tint)]/15 text-[10px] font-bold text-[var(--app-tint)]"
          >
            P
          </span>
          <span className="[font-family:var(--font-hanken)] text-[12px] font-semibold text-[var(--app-text)]">
            {APP_NAME}
          </span>
          <span className="ml-auto [font-family:var(--font-jetbrains-mono)] text-[10px] text-[var(--app-text-muted)]">
            {bolha.hora}
          </span>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--app-text-muted)]">
          {bolha.texto}
        </p>
      </div>
    );
  }

  const meu = bolha.de === "voce";

  return (
    <div className={meu ? "flex justify-end" : "flex justify-start"}>
      <div
        className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 shadow-[0_14px_34px_-20px_rgba(0,0,0,0.8)] ${
          meu
            ? "bg-[var(--app-tint)]/18 text-[var(--app-text)]"
            : "border border-white/[0.07] bg-[var(--app-surface)]/90 text-[var(--app-text)] backdrop-blur-sm"
        }`}
      >
        {bolha.audio ? (
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--app-tint)] text-[10px] text-[var(--app-on-tint)]"
            >
              ▶
            </span>
            <span
              aria-hidden="true"
              className="flex h-6 items-center gap-[2px]"
            >
              {[
                7, 12, 18, 10, 22, 15, 9, 20, 13, 24, 11, 17, 8, 14, 19, 10,
              ].map((altura, i) => (
                <span
                  key={i}
                  style={{ height: `${altura}px` }}
                  className="w-[2px] rounded-full bg-[var(--app-text)]/45"
                />
              ))}
            </span>
            <span className="[font-family:var(--font-jetbrains-mono)] text-[10px] text-[var(--app-text-muted)]">
              0:04
            </span>
          </div>
        ) : null}

        <p
          className={`text-[13px] leading-relaxed ${
            bolha.audio
              ? "mt-2 italic text-[var(--app-text-muted)]"
              : "[font-family:var(--font-hanken)]"
          }`}
        >
          {bolha.audio ? `“${bolha.texto}”` : bolha.texto}
        </p>

        {bolha.cartao ? (
          <div className="mt-2.5 flex items-center gap-2.5 rounded-xl bg-[var(--app-bg)]/70 p-2.5">
            <span
              aria-hidden="true"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--app-element)] text-[13px]"
            >
              🛒
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate [font-family:var(--font-hanken)] text-[12px] font-semibold">
                {bolha.cartao.titulo}
              </span>
              <span className="block truncate text-[10px] text-[var(--app-text-muted)]">
                {bolha.cartao.meta}
              </span>
            </span>
            <span className="[font-family:var(--font-jetbrains-mono)] text-[12px] font-semibold">
              {bolha.cartao.valor}
            </span>
          </div>
        ) : null}

        <p className="mt-1.5 text-right [font-family:var(--font-jetbrains-mono)] text-[9.5px] text-[var(--app-text-muted)]">
          {bolha.hora}
        </p>
      </div>
    </div>
  );
}

/** How long a moment stays still, in timeline units. */
const ESPERA = 1;
/** How long the crossing between two moments lasts, in the same units. */
const TRAVESSIA = 0.8;
/** Screens of scroll per unit. */
const ROLAGEM_POR_UNIDADE = 0.46;

/**
 * A day with the app, told as five moments.
 *
 * The timeline is built as HOLD, CROSS, HOLD, CROSS, and so on, rather than as
 * one continuous cross-fade. That structure is the whole point: a moment stays
 * completely still while it is being read, and the swap happens only while the
 * dot is travelling between two marks on the rail, landing exactly as the dot
 * reaches the next hour. Spread evenly instead, the text starts dissolving the
 * instant you scroll, long before the dot has gone anywhere, and the rail stops
 * meaning anything.
 *
 * The outgoing moment leaves upward and the incoming one arrives from below, so
 * the section reads as time moving forward rather than as two slides swapping.
 *
 * Above `md` the section pins. Below it, and for anyone who asked for less
 * movement, nothing is pinned and the same five moments are five blocks that
 * scroll normally, each carrying its own hour, with the rail collapsed away.
 */
export function AplicativoDiaADia() {
  const sectionRef = React.useRef<HTMLElement>(null);
  const total = MOMENTOS.length;
  const unidades = ESPERA * total + TRAVESSIA * (total - 1);

  /** Where a mark sits on the rail, as a percentage of its height. */
  const marca = (i: number) => `${(i / (total - 1)) * 100}%`;

  useScrollScene(sectionRef, () => {
    // Authored VISIBLE, because that is what mobile and reduced motion get.
    // Only this scene, which is the desktop one, hides what has not arrived.
    for (let i = 1; i < total; i += 1) {
      gsap.set(`.momento-${i}`, { autoAlpha: 0 });
      gsap.set(`.rail-marca-${i}`, { opacity: 0.32 });
    }
    gsap.set(".rail-ponto", { top: marca(0) });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: sectionRef.current,
        start: "top top",
        end: () =>
          `+=${Math.round(window.innerHeight * ROLAGEM_POR_UNIDADE * unidades)}`,
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true,
      },
    });

    for (let i = 1; i < total; i += 1) {
      const inicio = ESPERA + (i - 1) * (ESPERA + TRAVESSIA);

      tl.to(
        `.momento-${i - 1}`,
        {
          autoAlpha: 0,
          y: -64,
          duration: TRAVESSIA * 0.66,
          ease: "power2.in",
        },
        inicio,
      )
        .fromTo(
          `.momento-${i}`,
          { autoAlpha: 0, y: 72 },
          {
            autoAlpha: 1,
            y: 0,
            duration: TRAVESSIA * 0.7,
            ease: "power3.out",
          },
          inicio + TRAVESSIA * 0.3,
        )
        // The dot arrives on the mark exactly as the new moment settles.
        .to(
          ".rail-ponto",
          { top: marca(i), duration: TRAVESSIA, ease: "power2.inOut" },
          inicio,
        )
        .to(
          `.rail-marca-${i - 1}`,
          { opacity: 0.32, duration: TRAVESSIA * 0.5 },
          inicio,
        )
        .to(
          `.rail-marca-${i}`,
          { opacity: 1, duration: TRAVESSIA * 0.5 },
          inicio + TRAVESSIA * 0.5,
        );
    }

    // The final hold. Without it the last moment would be swept off the screen
    // the instant it arrives, because the timeline would end with the tween.
    tl.to({}, { duration: ESPERA });
  });

  return (
    <section
      ref={sectionRef}
      className="border-t border-white/[0.06] bg-[var(--app-bg)] px-6 py-28 text-[var(--app-text)] md:h-[100svh] md:overflow-hidden md:px-10 md:py-0"
    >
      <div className="mx-auto flex h-full max-w-6xl flex-col md:justify-center">
        <header>
          <p className="mb-4 inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--app-tint)]">
            <span className="h-px w-7 bg-[var(--app-tint)]/50" />
            Um dia qualquer
          </p>
          <h2 className="max-w-2xl [font-family:var(--font-hanken)] text-3xl font-bold leading-[1.1] tracking-[-0.02em] md:text-4xl">
            Seu dia a dia com o {APP_NAME}.
          </h2>
        </header>

        <div className="relative mt-12 md:mt-12 md:max-h-[30rem] md:min-h-[24rem] md:flex-1">
          {/* The rail. Desktop only: on a phone the hours live inside each
              block, where they do not need a column of their own. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-[46%] hidden w-px bg-white/[0.09] md:block"
          >
            <span className="rail-ponto absolute left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--app-tint)] shadow-[0_0_0_4px_rgba(109,220,158,0.15)]" />
            {MOMENTOS.map((momento, i) => (
              <span
                key={momento.horaCurta}
                style={{ top: marca(i) }}
                className={`rail-marca-${i} absolute left-4 -translate-y-1/2 whitespace-nowrap [font-family:var(--font-jetbrains-mono)] text-[11px] text-[var(--app-text-muted)]`}
              >
                <span
                  aria-hidden="true"
                  className="absolute -left-[1.05rem] top-1/2 h-px w-2 -translate-y-1/2 bg-white/20"
                />
                {momento.horaCurta}
              </span>
            ))}
          </div>

          {MOMENTOS.map((momento, i) => (
            <article
              key={momento.hora}
              className={`momento-${i} mb-16 last:mb-0 md:absolute md:inset-0 md:mb-0 md:grid md:grid-cols-[46%_8%_46%] md:items-center`}
            >
              <div className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-[linear-gradient(150deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))]">
                {/* The light of the hour. This is what carries the day passing,
                    in the absence of a photograph. */}
                <span
                  aria-hidden="true"
                  style={{ backgroundImage: momento.luz }}
                  className="pointer-events-none absolute inset-0"
                />
                <span
                  aria-hidden="true"
                  className="grain-overlay pointer-events-none absolute inset-0 opacity-[0.35]"
                />

                {momento.imagem ? (
                  <div className="relative aspect-[4/3]">
                    <Image
                      src={momento.imagem}
                      alt=""
                      fill
                      sizes="(min-width: 768px) 46vw, 100vw"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="relative flex aspect-[4/3] flex-col justify-end gap-3 p-6 md:p-8">
                    {momento.bolhas.map((bolha, b) => (
                      <BolhaChat key={b} bolha={bolha} />
                    ))}
                  </div>
                )}
              </div>

              <div className="md:col-start-3">
                <p className="mt-6 [font-family:var(--font-jetbrains-mono)] text-sm text-[var(--app-text-muted)] md:mt-0">
                  {momento.hora}
                </p>
                <h3 className="mt-3 [font-family:var(--font-hanken)] text-2xl font-bold leading-[1.15] tracking-[-0.02em] md:text-[2rem]">
                  {momento.titulo}{" "}
                  <span className="text-[var(--app-tint)]">
                    {momento.destaque}
                  </span>
                </h3>
                <p className="mt-4 max-w-md text-base leading-relaxed text-[var(--app-text-muted)]">
                  {momento.texto}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
