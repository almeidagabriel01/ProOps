"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Zap, ShieldCheck, Plug } from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export function LandingFeatures() {
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
      id="recursos"
      className="py-32 relative bg-card"
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-20 text-center">
          <h2 className="text-sm font-semibold text-brand-500 uppercase tracking-wider mb-3 gsap-fade-up">
            Arquitetura de Software
          </h2>
          <h3 className="text-4xl md:text-5xl font-bold mb-6 max-w-3xl mx-auto gsap-fade-up">
            Funcionalidades pensadas para a escala corporativa.
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="feature-card relative overflow-hidden p-8 rounded-2xl border border-border bg-gradient-to-br from-secondary to-card transition-all duration-500 group gsap-fade-up hover:-translate-y-2 hover:border-border hover:shadow-[0_15px_30px_-10px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_15px_30px_-10px_rgba(255,255,255,0.05)]">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <Zap className="text-brand-400 w-6 h-6" />
              </div>
              <h4 className="text-xl font-semibold mb-3 transition-colors">
                Sincronização Tempo Real
              </h4>
              <p className="text-muted-foreground text-sm leading-relaxed transition-colors">
                Esqueça a necessidade de atualizar a página. Alterações feitas
                por um utilizador refletem-se instantaneamente no ecrã de todos.
              </p>
            </div>
          </div>

          <div className="feature-card relative overflow-hidden p-8 rounded-2xl border border-border bg-gradient-to-br from-secondary to-card transition-all duration-500 group gsap-fade-up hover:-translate-y-2 hover:border-border hover:shadow-[0_15px_30px_-10px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_15px_30px_-10px_rgba(255,255,255,0.05)]">
            <div className="absolute inset-0 bg-gradient-to-br from-muted to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-lg bg-muted border border-border flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <ShieldCheck className="text-foreground w-6 h-6" />
              </div>
              <h4 className="text-xl font-semibold mb-3 transition-colors">
                Segurança Bancária
              </h4>
              <p className="text-muted-foreground text-sm leading-relaxed transition-colors">
                Criptografia ponta a ponta, backups automáticos de hora em hora
                e conformidade total com as rigorosas normas da RGPD.
              </p>
            </div>
          </div>

          <div className="feature-card relative overflow-hidden p-8 rounded-2xl border border-border bg-gradient-to-br from-secondary to-card transition-all duration-500 group gsap-fade-up hover:-translate-y-2 hover:border-border hover:shadow-[0_15px_30px_-10px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_15px_30px_-10px_rgba(255,255,255,0.05)]">
            <div className="absolute inset-0 bg-gradient-to-br from-muted to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-lg bg-muted border border-border flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <Plug className="text-foreground w-6 h-6" />
              </div>
              <h4 className="text-xl font-semibold mb-3 transition-colors">
                API Aberta (Headless)
              </h4>
              <p className="text-muted-foreground text-sm leading-relaxed transition-colors">
                Conecte a sua loja online, CRM externo ou aplicação móvel
                através da nossa API RESTful totalmente documentada.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
