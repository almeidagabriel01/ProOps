"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowRight, MessageCircle } from "lucide-react";
import { Accent } from "./_shared/section-heading";
import { MagneticButton } from "./_shared/magnetic-button";
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
      className="relative overflow-hidden border-t border-black/10 bg-white py-32 dark:border-white/10 dark:bg-neutral-950"
    >
      <div className="mx-auto max-w-4xl px-6 text-center">
        <p className="cta-fade-item mb-5 inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-black/55 dark:text-white/60">
          <span className="h-px w-6 bg-black/30 dark:bg-white/45" />
          Comece agora
        </p>

        <h2 className="cta-fade-item [font-family:var(--font-pdf-montserrat)] text-4xl font-bold leading-[1.05] tracking-tight text-black dark:text-white md:text-6xl">
          Leve sua operação para o <Accent>próximo nível</Accent>
        </h2>

        <p className="cta-fade-item mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-black/65 dark:text-white/65">
          Estruture propostas, financeiro, CRM, equipe e automações em uma base
          única, com onboarding guiado para o seu time.
        </p>

        <div className="cta-fade-item mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <MagneticButton
            href="/register"
            variant="solid"
            size="lg"
            fullWidth
            className="sm:w-auto"
            trailingIcon={<ArrowRight className="h-5 w-5" />}
          >
            Começar grátis
          </MagneticButton>

          {WHATSAPP_HREF ? (
            <MagneticButton
              href={WHATSAPP_HREF}
              external
              variant="outline"
              size="lg"
              fullWidth
              className="sm:w-auto"
              icon={<MessageCircle className="h-5 w-5" />}
            >
              Falar no WhatsApp
            </MagneticButton>
          ) : (
            <MagneticButton
              href="mailto:gestao@proops.com.br"
              external
              variant="outline"
              size="lg"
              fullWidth
              className="sm:w-auto"
            >
              Solicitar demonstração
            </MagneticButton>
          )}
        </div>

        <p className="cta-fade-item mt-8 text-sm text-black/55 dark:text-white/55">
          Sem cartão de crédito · Implantação assistida · Sem lock-in
        </p>
      </div>
    </section>
  );
}
