"use client";

import React, { useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Lock } from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export function LandingShowcase() {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      // Setup initial 3D position
      gsap.set("#dashboard-mockup", {
        rotationX: 25,
        rotationY: -10,
        scale: 0.85,
        y: 100,
        opacity: 0.5,
      });

      // Animate on scroll
      gsap.to("#dashboard-mockup", {
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 92%",
          end: "top 30%",
          scrub: 0.7,
        },
        rotationX: 0,
        rotationY: 0,
        scale: 1,
        y: 0,
        opacity: 1,
        ease: "power2.out",
      });

      // Simple wrapper for fade ups inside this component
      gsap.utils.toArray(".gsap-fade-up").forEach((el: unknown) => {
        const element = el as Element;
        gsap.fromTo(
          element,
          { y: 30, opacity: 0, autoAlpha: 0 },
          {
            y: 0,
            opacity: 1,
            autoAlpha: 1,
            duration: 0.55,
            ease: "power2.out",
            scrollTrigger: {
              trigger: element,
              start: "top 98%",
              end: "bottom 10%",
              toggleActions: "play none none reverse",
              fastScrollEnd: true,
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
      id="showcase"
      className="relative py-32 px-6 z-20"
    >
      <div className="max-w-6xl mx-auto text-center mb-16">
        <h2 className="text-3xl md:text-5xl font-bold mb-6 gsap-fade-up">
          Visibilidade total do seu negócio
        </h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto gsap-fade-up">
          O nosso painel principal não é apenas um conjunto de gráficos. É o
          centro de comando neural da sua empresa, atualizado em tempo real.
        </p>
      </div>

      <div className="max-w-6xl mx-auto">
        <div style={{ perspective: "2000px" }}>
          <div
            id="dashboard-mockup"
            className="relative rounded-2xl border border-border bg-card shadow-[0_0_50px_rgba(0,0,0,0.1)] dark:shadow-[0_0_50px_rgba(255,255,255,0.05)] overflow-hidden will-change-transform"
          >
            <div className="h-12 border-b border-border flex items-center px-6 gap-2 bg-card">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-muted-foreground/30"></div>
                <div className="w-3 h-3 rounded-full bg-muted-foreground/30"></div>
                <div className="w-3 h-3 rounded-full bg-muted-foreground/30"></div>
              </div>
              <div className="mx-auto px-4 py-1 rounded-md bg-muted border border-border text-xs text-muted-foreground font-mono flex items-center gap-2">
                <Lock className="w-3 h-3" />
                app.nexerp.com/dashboard
              </div>
            </div>

            <div className="aspect-[16/9] bg-background relative overflow-hidden group">
              <Image
                src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop"
                alt="Dashboard ERP"
                width={2070}
                height={1380}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-background/35 via-transparent to-transparent"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
