import React from "react";

import { LandingButton } from "@/components/landing/_shared/landing-button";
import { MonoField } from "@/components/landing/_shared/mono-field";
import { ChromeText } from "@/components/marketing/_shared/chrome-text";
import { PauseOffscreen } from "@/components/marketing/_shared/pause-offscreen";
import { SITE_URLS } from "@/lib/site/surfaces";

const WORDMARK = "ProOps";

/**
 * The company page opens on near-black, with the wordmark struck in metal.
 *
 * A Server Component on purpose. Everything above the fold is CSS: the letters
 * rise from a clipped baseline and the copy fades up through the `hero-enter`
 * keyframes, which auto-play at first paint with no JavaScript. The ERP landing
 * learned this the hard way, and the reason is written into globals.css: a
 * motion library's `initial={{ opacity: 0 }}` holds the LCP text invisible
 * until the bundle hydrates, which on a throttled phone is several seconds.
 *
 * The one interactive piece, the chrome sweep, is a client island inside
 * ChromeText, and it only carries an IntersectionObserver.
 */
export function InstitucionalHero() {
  return (
    <section className="relative isolate flex min-h-[100svh] flex-col justify-center overflow-hidden bg-neutral-950 px-6 py-24 text-white md:px-10">
      <MonoField />

      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <p
          className="hero-enter mb-8 inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/55 md:text-xs"
          style={
            {
              "--hero-y": "-10px",
              "--hero-blur": "6px",
              "--hero-dur": "0.5s",
            } as React.CSSProperties
          }
        >
          <span className="h-px w-7 bg-white/40" />
          Software de gestão
        </p>

        {/*
          Each letter carries its own ChromeText, because background-clip:text
          only paints the glyphs of the element that owns the background. The
          vertical ramp is identical per letter, so the metal still reads as one
          surface; the sweep delay is staggered, so the highlight travels across
          the word instead of firing on all six at once. One PauseOffscreen for
          the group, not one observer per letter.
        */}
        <PauseOffscreen className="mb-10 md:mb-14">
          <span className="sr-only">{WORDMARK}</span>
          <span
            aria-hidden="true"
            className="flex select-none flex-wrap [font-family:var(--font-bricolage)] text-[clamp(4rem,17vw,13rem)] font-extrabold leading-[0.88] tracking-[-0.045em]"
          >
            {/*
              overflow-hidden is what clips the letter before it rises. Without
              room below the baseline it also decapitates the descender of the
              "p"; the negative margin gives that room back to the line box so
              the block does not grow.
            */}
            {WORDMARK.split("").map((letter, index) => (
              <span
                key={index}
                className="-mb-[0.2em] block overflow-hidden pb-[0.24em]"
              >
                <ChromeText
                  className="hero-rise-line"
                  delaySeconds={1.4 + index * 0.08}
                  style={
                    {
                      "--hero-delay": `${0.08 + index * 0.055}s`,
                      "--hero-dur": "1s",
                    } as React.CSSProperties
                  }
                >
                  {letter}
                </ChromeText>
              </span>
            ))}
          </span>
        </PauseOffscreen>

        <h1
          className="hero-enter max-w-3xl [font-family:var(--font-bricolage)] text-2xl font-semibold leading-[1.18] tracking-tight text-white md:text-4xl"
          style={
            {
              "--hero-y": "20px",
              "--hero-delay": "0.45s",
            } as React.CSSProperties
          }
        >
          Software de gestão para a empresa que vende projeto,{" "}
          <em className="[font-family:var(--font-fraunces)] font-normal italic text-white/85">
            e para a pessoa por trás dela
          </em>
          .
        </h1>

        <p
          className="hero-enter mt-6 max-w-2xl text-base leading-relaxed text-white/60 md:text-lg"
          style={
            {
              "--hero-y": "16px",
              "--hero-delay": "0.58s",
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
              "--hero-delay": "0.7s",
              "--hero-dur": "0.5s",
            } as React.CSSProperties
          }
        >
          <LandingButton
            href={SITE_URLS.erp}
            external
            variant="inverted"
            size="lg"
          >
            Conhecer o ERP
          </LandingButton>
          <LandingButton href={SITE_URLS.app} external variant="link" size="lg">
            Conhecer o aplicativo
          </LandingButton>
        </div>
      </div>
    </section>
  );
}
