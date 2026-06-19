"use client";

import React from "react";
import dynamic from "next/dynamic";
import {
  useLandingPage,
  LandingNavbar,
  LandingHeroAssemble,
} from "@/components/landing";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import Lenis from "lenis";

// Seções abaixo da dobra: code-split com next/dynamic (ssr: true por padrão),
// mantendo HTML server-rendered e animações scroll-triggered intactas.
// Import por caminho direto (não pelo barrel) para o webpack dividir de fato.
const LandingFeatureScroll = dynamic(() =>
  import("@/components/landing/landing-feature-scroll").then((m) => m.LandingFeatureScroll),
);
const LandingHowItWorks = dynamic(() =>
  import("@/components/landing/landing-how-it-works").then((m) => m.LandingHowItWorks),
);
const LandingFeatures = dynamic(() =>
  import("@/components/landing/landing-features").then((m) => m.LandingFeatures),
);
const LandingIntegrations = dynamic(() =>
  import("@/components/landing/landing-integrations").then((m) => m.LandingIntegrations),
);
const LandingNiches = dynamic(() =>
  import("@/components/landing/landing-niches").then((m) => m.LandingNiches),
);
const LandingSecurity = dynamic(() =>
  import("@/components/landing/landing-security").then((m) => m.LandingSecurity),
);
const LandingPricing = dynamic(() =>
  import("@/components/landing/landing-pricing").then((m) => m.LandingPricing),
);
const LandingFAQ = dynamic(() =>
  import("@/components/landing/landing-faq").then((m) => m.LandingFAQ),
);
const LandingCTA = dynamic(() =>
  import("@/components/landing/landing-cta").then((m) => m.LandingCTA),
);
const LandingFooter = dynamic(() =>
  import("@/components/landing/landing-footer").then((m) => m.LandingFooter),
);
const WhatsAppFloat = dynamic(() =>
  import("@/components/landing/whatsapp-float").then((m) => m.WhatsAppFloat),
);

export function LandingPageClient() {
  const {
    currentUser,
    isAuthLoading,
    billingInterval,
    setBillingInterval,
    plans,
    isLoadingPlans,
    handleSignOut,
  } = useLandingPage();

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    // O hero é scroll-scrubbed + pinned: no load (scroll=0) já está no estado
    // visível natural. Lenis (smooth scroll) e o ScrollTrigger.refresh só são
    // necessários quando o usuário começa a rolar. Inicializá-los DEPOIS do
    // primeiro paint (requestIdleCallback / fallback setTimeout) tira esse JS
    // do caminho crítico do LCP do hero sem mudar nada visualmente — o usuário
    // não rolou ainda no primeiro ~1s.
    let lenis: Lenis | null = null;
    let raf: ((time: number) => void) | null = null;
    let refreshTimeoutId: number | undefined;
    let cancelled = false;

    const init = () => {
      if (cancelled) return;

      gsap.registerPlugin(ScrollTrigger);
      // refresh não-bloqueante: roda após o paint, recalcula os ScrollTriggers
      // (pin/scrub) já registrados pelo hero. Sem o setTimeout de 500ms síncrono.
      refreshTimeoutId = window.setTimeout(() => {
        ScrollTrigger.refresh();
      }, 0);

      // Lenis (smooth scroll) sincronizado ao ScrollTrigger — só na landing e
      // só quando o usuário não pediu redução de movimento
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        lenis = new Lenis();
        lenis.on("scroll", ScrollTrigger.update);
        raf = (time: number) => lenis?.raf(time * 1000);
        gsap.ticker.add(raf);
        gsap.ticker.lagSmoothing(0);
      }
    };

    // Adia para depois do primeiro paint, cedendo a thread principal ao LCP.
    const hasRic = typeof window.requestIdleCallback === "function";
    const idleId = hasRic
      ? window.requestIdleCallback(init, { timeout: 2000 })
      : window.setTimeout(init, 1);

    return () => {
      cancelled = true;
      if (hasRic) {
        window.cancelIdleCallback?.(idleId as number);
      } else {
        window.clearTimeout(idleId as number);
      }
      if (refreshTimeoutId !== undefined) window.clearTimeout(refreshTimeoutId);
      if (raf) gsap.ticker.remove(raf);
      lenis?.destroy();
    };
  }, []);

  return (
    <div className="min-h-screen overflow-x-clip bg-white text-black selection:bg-black selection:text-white dark:bg-neutral-950 dark:text-neutral-100 dark:selection:bg-white dark:selection:text-black">
      <LandingNavbar currentUser={currentUser} isAuthLoading={isAuthLoading} onSignOut={handleSignOut} />

      <main>
        <LandingHeroAssemble />
        <LandingFeatureScroll />
        <LandingHowItWorks />
        <LandingFeatures />
        <LandingIntegrations />
        <LandingNiches />
        <LandingSecurity />

        <LandingPricing
          plans={plans}
          currentUser={currentUser}
          billingInterval={billingInterval}
          setBillingInterval={setBillingInterval}
          isLoading={isLoadingPlans}
        />

        <LandingFAQ />
        <LandingCTA />
      </main>

      <LandingFooter />

      <WhatsAppFloat />
    </div>
  );
}
