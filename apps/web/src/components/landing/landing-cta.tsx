"use client";

import React, { useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowRight, MessageCircle } from "lucide-react";
import { MonoField } from "./_shared/mono-field";
import { Accent } from "./_shared/section-heading";
import { WHATSAPP_HREF } from "./_shared/whatsapp";

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
      className="relative overflow-hidden bg-[#0a0a0a] py-32 text-white dark:bg-black"
    >
      <MonoField />

      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <p className="cta-fade-item mb-5 inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
          <span className="h-px w-6 bg-white/45" />
          Comece agora
        </p>

        <h2 className="cta-fade-item [font-family:var(--font-pdf-montserrat)] text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
          Leve sua operação para o <Accent>próximo nível</Accent>
        </h2>

        <p className="cta-fade-item mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/65">
          Estruture propostas, financeiro, CRM, equipe e automações em uma base
          única, com onboarding guiado para o seu time.
        </p>

        <div className="cta-fade-item mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/register"
            className="btn-sweep flex w-full items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-lg font-bold text-black transition-colors hover:bg-white/90 sm:w-auto"
          >
            Começar grátis
            <ArrowRight className="h-5 w-5" />
          </Link>

          {WHATSAPP_HREF ? (
            <a
              href={WHATSAPP_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-full border border-white/25 px-8 py-4 text-lg font-semibold text-white transition-colors hover:border-white/50 hover:bg-white/[0.06] sm:w-auto"
            >
              <MessageCircle className="h-5 w-5" />
              Falar no WhatsApp
            </a>
          ) : (
            <a
              href="mailto:gestao@proops.com.br"
              className="flex w-full items-center justify-center gap-2 rounded-full border border-white/25 px-8 py-4 text-lg font-semibold text-white transition-colors hover:border-white/50 hover:bg-white/[0.06] sm:w-auto"
            >
              Solicitar demonstração
            </a>
          )}
        </div>

        <p className="cta-fade-item mt-8 text-sm text-white/55">
          Sem cartão de crédito · Implantação assistida · Sem lock-in
        </p>
      </div>
    </section>
  );
}
