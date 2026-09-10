"use client";

import React from "react";
import dynamic from "next/dynamic";

import { LandingButton } from "@/components/landing/_shared/landing-button";
import { Magnetic } from "@/components/marketing/_shared/magnetic";
import { useCampoPonteiro } from "@/components/marketing/_shared/pointer-field-provider";
import { DesktopOnlyWebGl } from "@/components/marketing/_shared/webgl/desktop-only";
import { Realce } from "@/components/institucional/secao";
import { SITE_URLS } from "@/lib/site/surfaces";

/**
 * The shader layer. `ssr: false` because it is a canvas and there is nothing to
 * render on the server; the import itself does not begin until
 * `DesktopOnlyWebGl` decides the machine should have it, which is what keeps the
 * module out of the phone's bundle and out of the Lighthouse run entirely.
 */
const FlowField = dynamic(
  () => import("@/components/marketing/_shared/webgl/flow-field"),
  { ssr: false },
);

const WORDMARK = "ProOps";

/**
 * The company page opens on near-black, with the wordmark as type and nothing
 * else.
 *
 * The chrome finish is gone on purpose. Metal reads as a product shot, and this
 * is a company: the weight here comes from the size of the letters, the space
 * around them and the field reacting to the reader, not from a surface
 * treatment.
 *
 * **Everything above the fold is still CSS.** The letters rise from a clipped
 * baseline and the copy fades up through the `hero-enter` / `hero-rise-line`
 * keyframes, which auto-play at first paint with no JavaScript. The ERP landing
 * learned this the hard way and the reason is written into globals.css: a motion
 * library's `initial={{ opacity: 0 }}` holds the LCP text invisible until the
 * bundle hydrates, which on a throttled phone is several seconds. The component
 * is a client component only because of the field below the type; the type
 * itself does not depend on that having loaded.
 *
 * The field is three layers, each a fallback for the one above it:
 *   1. a WebGL flow field, desktop with a real cursor only
 *   2. `.campo-reativo`, two CSS glows reading the same `--px`/`--py`
 *   3. a static gradient, for `prefers-reduced-motion`, where the vars stay 0
 */
export function InstitucionalHero() {
  // The field itself lives on the shell, so `--px`/`--py` are inherited by every
  // section of the site. Only the iOS permission affordance is local, because
  // this is the one screen with room to offer it.
  const { precisaDePermissao, pedirPermissao } = useCampoPonteiro();

  return (
    <section
      aria-label="ProOps"
      className="relative isolate flex min-h-[100svh] flex-col justify-center overflow-hidden bg-neutral-950 px-6 py-28 text-white md:px-10"
    >
      {/* Layer 2, always present. The WebGL canvas sits ON TOP of it rather than
          replacing it, so a failed context or a blocked GPU degrades to this
          without a flash. */}
      <div aria-hidden="true" className="campo-reativo" />
      <div
        aria-hidden="true"
        className="grade-pontos pointer-events-none absolute inset-0 opacity-60"
      />
      <DesktopOnlyWebGl>
        <FlowField
          intensidade={0.34}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
      </DesktopOnlyWebGl>

      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <p
          className="hero-enter mb-8 inline-flex items-center gap-2.5 [font-family:var(--font-geist-mono)] text-[11px] font-medium uppercase tracking-[0.28em] text-white/55 md:text-xs"
          style={
            {
              "--hero-y": "-10px",
              "--hero-blur": "6px",
              "--hero-dur": "0.5s",
              "--hero-delay": "1.25s",
            } as React.CSSProperties
          }
        >
          <span aria-hidden="true" className="h-px w-7 bg-white/40" />
          Software de gestão
        </p>

        {/*
          One span per letter, each clipped by its own wrapper so the glyph rises
          from an invisible baseline. `overflow-hidden` is what does the clipping;
          without room below the baseline it also decapitates the descender of
          the "p", and the negative margin gives that room back to the line box
          so the block does not grow taller than the type.

          `--px` is read per letter with an increasing weight, so the word shears
          toward the cursor instead of sliding as a rigid block. It is the one
          piece of the hero that moves after the entrance, and it is CSS reading
          two inherited variables, not a tween per letter.
        */}
        <h1 className="mb-10 md:mb-14">
          <span className="sr-only">
            ProOps, software de gestão para a empresa que vende projeto e para a
            pessoa por trás dela
          </span>
          <span
            aria-hidden="true"
            className="flex select-none flex-wrap [font-family:var(--font-bricolage)] text-[clamp(4rem,17vw,13rem)] font-extrabold leading-[0.88] tracking-[-0.045em]"
          >
            {WORDMARK.split("").map((letter, index) => (
              <span
                key={index}
                className="-mb-[0.2em] block overflow-hidden pb-[0.24em]"
              >
                <span
                  className="hero-rise-line"
                  style={
                    {
                      "--hero-delay": `${1.08 + index * 0.055}s`,
                      "--hero-dur": "1s",
                    } as React.CSSProperties
                  }
                >
                  {/*
                    The shear is on its OWN span, one level in. A CSS animation
                    beats inline style in the cascade, so `hero-rise-line`'s
                    `transform: translateY(0)` at `both` would overwrite an
                    inline translateX on the same element, and the letters would
                    simply never move. Two elements, one transform each.
                  */}
                  <span
                    className="inline-block"
                    style={{
                      transform: `translateX(calc(var(--px, 0) * ${
                        (index + 1) * 1.6
                      }px))`,
                      transition: "transform 0.5s cubic-bezier(.16,1,.3,1)",
                    }}
                  >
                    {letter}
                  </span>
                </span>
              </span>
            ))}
          </span>
        </h1>

        <p
          className="hero-enter max-w-3xl [font-family:var(--font-bricolage)] text-2xl font-semibold leading-[1.18] tracking-tight text-white md:text-4xl"
          style={
            {
              "--hero-y": "20px",
              "--hero-delay": "1.5s",
            } as React.CSSProperties
          }
        >
          Software de gestão para a empresa que vende projeto,{" "}
          <Realce className="text-white/85">e para a pessoa por trás dela</Realce>
          .
        </p>

        <p
          className="hero-enter mt-6 max-w-2xl text-base leading-relaxed text-white/60 md:text-lg"
          style={
            {
              "--hero-y": "16px",
              "--hero-delay": "1.62s",
            } as React.CSSProperties
          }
        >
          A ProOps constrói duas coisas: um ERP que leva a proposta até o
          pós-venda, e um aplicativo que organiza o dinheiro do dia a dia por
          mensagem.
        </p>

        <div
          className="hero-enter mt-10 flex flex-col gap-3 sm:flex-row sm:items-center"
          style={
            {
              "--hero-y": "12px",
              "--hero-delay": "1.74s",
              "--hero-dur": "0.5s",
            } as React.CSSProperties
          }
        >
          <Magnetic>
            <LandingButton
              href={SITE_URLS.erp}
              external
              variant="inverted"
              size="lg"
            >
              Conhecer o ERP
            </LandingButton>
          </Magnetic>
          <LandingButton href={SITE_URLS.app} external variant="link" size="lg">
            Conhecer o aplicativo
          </LandingButton>
        </div>

        {/*
          iOS 13 put the gyroscope behind a permission that can only be asked
          for from a gesture, so on an iPhone the tilt cannot start on its own.
          Offering it beats pretending the feature does not exist there, and the
          button only renders where the prompt actually exists: on Android, on
          desktop, and once answered, it is gone. Declining costs nothing, since
          the field falls back to scroll velocity either way.
        */}
        {precisaDePermissao && (
          <button
            type="button"
            onClick={() => void pedirPermissao()}
            className="hero-enter mt-10 inline-flex items-center gap-2 border-b border-white/25 pb-1 [font-family:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.2em] text-white/55 transition-colors hover:text-white"
            style={{ "--hero-delay": "2s" } as React.CSSProperties}
          >
            Ativar movimento
          </button>
        )}
      </div>

      <div
        aria-hidden="true"
        className="hero-enter absolute inset-x-0 bottom-8 flex justify-center"
        style={
          {
            "--hero-delay": "2.1s",
            "--hero-y": "-8px",
          } as React.CSSProperties
        }
      >
        <span className="[font-family:var(--font-geist-mono)] text-[10px] uppercase tracking-[0.3em] text-white/35">
          Role
        </span>
      </div>
    </section>
  );
}
