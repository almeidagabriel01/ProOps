import React from "react";

import { LandingButton } from "@/components/landing/_shared/landing-button";
import { ChromeText } from "@/components/marketing/_shared/chrome-text";
import { PauseOffscreen } from "@/components/marketing/_shared/pause-offscreen";
import { SITE_URLS } from "@/lib/site/surfaces";

import { NUMEROS } from "../_content/institucional-copy";
import { PlaceholderBadge } from "./placeholder-badge";

/**
 * The numbers, then the way out.
 *
 * Metal returns here as a bookend to the hero, at a quieter size: the page
 * opens on the wordmark in chrome and closes on the invitation in the same
 * material.
 */
export function InstitucionalCta() {
  return (
    <section className="bg-neutral-950 px-6 py-28 text-white md:px-10 md:py-40">
      <div className="mx-auto max-w-6xl">
        <PlaceholderBadge>números a confirmar</PlaceholderBadge>

        <dl className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-3">
          {NUMEROS.map((numero) => (
            <div key={numero.rotulo} className="bg-neutral-950 p-8 md:p-10">
              <dt className="order-2 mt-3 text-sm text-white/50">
                {numero.rotulo}
              </dt>
              <dd className="[font-family:var(--font-bricolage)] text-4xl font-extrabold tabular-nums tracking-tight md:text-5xl">
                {numero.valor}
              </dd>
            </div>
          ))}
        </dl>

        <PauseOffscreen className="mt-24 text-center md:mt-32">
          <ChromeText
            as="h2"
            delaySeconds={0.6}
            className="mx-auto max-w-4xl [font-family:var(--font-bricolage)] text-[clamp(2rem,6vw,4.5rem)] font-extrabold leading-[1.02] tracking-[-0.03em]"
          >
            Escolha por onde começar.
          </ChromeText>
        </PauseOffscreen>

        <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
