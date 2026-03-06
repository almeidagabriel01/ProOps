"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export function LandingCTA() {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.utils.toArray(".gsap-fade-up").forEach((el: unknown) => {
        const element = el as Element;
        gsap.fromTo(
          element,
          { y: 30, opacity: 0, autoAlpha: 0 },
          {
            y: 0,
            opacity: 1,
            autoAlpha: 1,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: {
              trigger: element,
              start: "top 90%",
              end: "bottom 10%",
              toggleActions: "play reverse play reverse",
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
      className="py-32 relative overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-900/20 via-background to-background"
    >
      <div className="absolute inset-0 z-0 grid-bg opacity-20"></div>

      <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
        <h2 className="text-4xl md:text-6xl font-bold mb-6 text-foreground gsap-fade-up">
          Pronto para assumir o controlo?
        </h2>
        <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto gsap-fade-up">
          Junte-se a centenas de empresas que abandonaram sistemas lentos e
          confusos. Beneficie de uma migração guiada e suporte premium dedicado.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 gsap-fade-up">
          <Link
            href="/register"
            className="w-full sm:w-auto px-8 py-4 bg-white text-black rounded-full font-bold hover:bg-gray-200 transition-all flex items-center justify-center gap-2 text-lg shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:scale-105"
          >
            Agendar Demonstração Gratuita
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
        <p className="mt-8 text-sm text-muted-foreground gsap-fade-up">
          Implementação rápida. Sem fidelizações ocultas.
        </p>
      </div>
    </section>
  );
}
