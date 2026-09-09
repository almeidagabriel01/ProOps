"use client";

import React from "react";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import { LiquidGlass } from "@/components/marketing/_shared/liquid-glass";
import { SCENE_ANY_WIDTH } from "@/components/marketing/_shared/use-scroll-scene";
import { APP_NAME } from "@/lib/site/app-brand";

import { DeviceFrame } from "./device-frame";

/**
 * The real Hoje screen, with the capture arriving on top of it.
 *
 * This started as a full HTML rebuild of the screen, so the card could animate.
 * That bought the movement and cost the fidelity: the reconstruction drifted
 * from the product in a dozen small ways, and it sits on the same page as the
 * actual captures, where any drift reads as the mock being fake.
 *
 * Overlaying gets both. The screen is the untouched screenshot, so it is the
 * app by definition, and the one thing that has to move is a real card that
 * the app itself shows, floating in over it in the same glass the app is built
 * from. Nothing about the screen is redrawn, so nothing about it can be wrong.
 *
 * The card is authored in its FINAL state and animated with `fromTo`. Under
 * reduced motion nothing is registered and it is simply already sitting there,
 * message and entry both readable.
 */
export function AppCapturePhone() {
  const rootRef = React.useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(SCENE_ANY_WIDTH, () => {
        const tl = gsap.timeline({ defaults: { ease: "expo.out" }, delay: 1 });
        // The scrim carries the same class, so it fades in with the card
        // instead of dimming the screen before there is anything to dim.
        tl.fromTo(
          ".capture-card",
          { yPercent: 18, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: 0.85 },
        )
          .fromTo(
            ".capture-quote",
            { opacity: 0, y: 8 },
            { opacity: 1, y: 0, duration: 0.5 },
            "-=0.42",
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
    <div ref={rootRef} className="relative mx-auto w-full max-w-[22rem]">
      <DeviceFrame platform="ios">
        <Image
          src="/mockup-ios/hoje.jpg"
          alt={`Tela inicial do ${APP_NAME}, com a sobra projetada do mês e as pendências do dia`}
          fill
          sizes="(min-width: 1024px) 22rem, (min-width: 640px) 60vw, 80vw"
          priority
          className="object-cover"
        />

        {/* A scrim under the card, stopping just short of the tab bar.
            Without it the card lands squarely on top of another card and reads
            as a rendering fault; with the list dissolving underneath, the same
            overlap reads as a sheet rising over the screen, which is what the
            platform does and what the app itself does. It fades UP so the
            content nearest the card disappears and the content further away
            stays legible. */}
        <div
          aria-hidden="true"
          className="capture-card pointer-events-none absolute inset-x-0 bottom-[10%] h-[34%] bg-gradient-to-t from-[var(--app-bg)] via-[var(--app-bg)]/92 to-transparent"
        />

        {/* Sits above the tab bar, which occupies roughly the bottom tenth of
            the capture. Percentages rather than pixels so it stays put at every
            frame size. */}
        {/* The positioning lives on a wrapper, not on the glass itself.
            `.liquid-glass` sets `position: relative` and, being unlayered, it
            beats Tailwind's `absolute` utility on equal specificity, so the
            card silently flowed to the top of the screen instead of docking
            above the tab bar. */}
        <div className="capture-card absolute inset-x-[4%] bottom-[13%]">
          <LiquidGlass className="rounded-2xl p-[4.5%]">
            <p className="flex items-center gap-1.5 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-[var(--app-tint)]">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-[var(--app-tint)]"
              />
              Capturado no WhatsApp
            </p>

            <p className="capture-quote mt-2 [font-family:var(--font-hanken)] text-[0.72rem] italic leading-snug text-[var(--app-text-muted)]">
              &ldquo;gastei 45 no mercado&rdquo;
            </p>

            <div className="capture-entry mt-2.5 flex items-center gap-2.5 border-t border-white/10 pt-2.5">
              <span
                aria-hidden="true"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--app-element)] text-[0.75rem]"
              >
                🛒
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate [font-family:var(--font-hanken)] text-[0.72rem] font-semibold text-[var(--app-text)]">
                  Mercado
                </span>
                <span className="block truncate text-[0.6rem] text-[var(--app-text-muted)]">
                  Alimentação · Cartão
                </span>
              </span>
              <span className="capture-amount [font-family:var(--font-jetbrains-mono)] text-[0.72rem] font-semibold text-[var(--app-text)]">
                R$ 45,00
              </span>
            </div>
          </LiquidGlass>
        </div>
      </DeviceFrame>
    </div>
  );
}
