"use client";

import dynamic from "next/dynamic";
// Direct imports (not the @/components/landing barrel): the barrel re-exports
// LandingHeroAssemble → hero-dashboard-demo → Recharts, which webpack then can't
// tree-shake out, dragging ~100KB of charts the niche pages never use into their
// chunk. Importing the source files directly keeps that off these routes.
import { useLandingSession } from "@/components/landing/use-landing-session";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { NicheHero } from "./niche-hero";
import { NICHE_LANDING_CONFIG } from "@/lib/landing/niches.config";
import type { TenantNiche } from "@/types";

// Abaixo da dobra: code-split com next/dynamic (ssr: true), HTML preservado.
const NicheFeatures = dynamic(() =>
  import("./niche-features").then((m) => m.NicheFeatures),
);
const NicheModules = dynamic(() =>
  import("./niche-modules").then((m) => m.NicheModules),
);
const NicheFaq = dynamic(() => import("./niche-faq").then((m) => m.NicheFaq));
const NicheCta = dynamic(() => import("./niche-cta").then((m) => m.NicheCta));
const LandingFooter = dynamic(() =>
  import("@/components/landing/landing-footer").then((m) => m.LandingFooter),
);

interface NicheLandingPageProps {
  slug: TenantNiche;
}

export function NicheLandingPage({ slug }: NicheLandingPageProps) {
  const config = NICHE_LANDING_CONFIG[slug];
  const { currentUser, isAuthLoading, handleSignOut } = useLandingSession();

  return (
    <div className="min-h-screen overflow-x-clip bg-white text-black selection:bg-black selection:text-white dark:bg-neutral-950 dark:text-neutral-100 dark:selection:bg-white dark:selection:text-black">
      <LandingNavbar currentUser={currentUser} isAuthLoading={isAuthLoading} onSignOut={handleSignOut} />

      <main>
        <NicheHero hero={config.hero} currentUser={currentUser} isAuthLoading={isAuthLoading} />
        <NicheFeatures features={config.features} />
        <NicheModules
          modules={config.modules}
          sectionTitle={config.modulesSection.title}
          sectionSubtitle={config.modulesSection.subtitle}
        />
        <NicheFaq faq={config.faq} />
        <NicheCta cta={config.cta} signupHref={config.hero.primaryCta.href} />
      </main>

      <LandingFooter />
    </div>
  );
}
