"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ProOpsLogo } from "@/components/branding/proops-logo";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export function LandingCTA() {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = containerRef.current;
      if (!section) return;

      const fadeItems = section.querySelectorAll<HTMLElement>(".cta-fade-item");
      if (fadeItems.length === 0) return;

      fadeItems.forEach((item) => {
        gsap.fromTo(
          item,
          { y: 28, opacity: 0, autoAlpha: 0 },
          {
            y: 0,
            opacity: 1,
            autoAlpha: 1,
            duration: 0.9,
            ease: "power2.out",
            scrollTrigger: {
              trigger: item,
              start: "top 92%",
              end: "top -18%",
              toggleActions: "play none play reset",
              invalidateOnRefresh: true,
            },
          },
        );
      });
    },
    { scope: containerRef },
  );

  return (
    <section
      ref={containerRef}
      className="py-28 relative overflow-hidden bg-white dark:bg-neutral-950"
    >
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_top,rgba(0,0,0,0.08)_0,transparent_55%)] dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12)_0,transparent_55%)]" />

      <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
        <div className="flex justify-center mb-2 cta-fade-item">
          <ProOpsLogo
            variant="full"
            width={440}
            height={148}
            invertOnDark
            className="h-32 w-auto"
          />
        </div>

        <h2 className="text-4xl md:text-6xl font-bold mb-6 text-black dark:text-white cta-fade-item">
          Leve a operação para o próximo nível.
        </h2>
        <p className="text-xl text-black/65 dark:text-white/70 mb-10 max-w-3xl mx-auto cta-fade-item">
          Estruture propostas, financeiro, CRM, equipe e automações em uma base
          única com onboarding guiado para o seu time.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 cta-fade-item">
          <Link
            href="/register"
            className="w-full sm:w-auto px-8 py-4 bg-black dark:bg-white text-white dark:text-black rounded-full font-bold hover:bg-black/85 dark:hover:bg-white/90 transition-all flex items-center justify-center gap-2 text-lg cursor-pointer"
          >
            Solicitar demonstração
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
        <p className="mt-8 text-sm text-black/55 dark:text-white/55 cta-fade-item">
          Implantação assistida, suporte contínuo e sem lock-in.
        </p>
      </div>
    </section>
  );
}
