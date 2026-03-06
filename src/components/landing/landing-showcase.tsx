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
      const section = containerRef.current;
      if (!section) return;

      const headingItems = section.querySelectorAll<HTMLElement>(".showcase-heading");
      headingItems.forEach((item) => {
        gsap.fromTo(
          item,
          { y: 26, opacity: 0, autoAlpha: 0 },
          {
            y: 0,
            opacity: 1,
            autoAlpha: 1,
            ease: "none",
            scrollTrigger: {
              trigger: item,
              start: "top 95%",
              end: "top 72%",
              scrub: true,
              invalidateOnRefresh: true,
            },
          },
        );
      });

      const mockupElement = section.querySelector<HTMLElement>(".showcase-mockup");
      if (!mockupElement) return;

      gsap.set(mockupElement, {
        rotationX: 22,
        rotationY: -10,
        scale: 0.84,
        y: 110,
        opacity: 0.35,
      });

      gsap.to(mockupElement, {
        scrollTrigger: {
          trigger: mockupElement,
          start: "top 92%",
          end: "top 58%",
          scrub: true,
          invalidateOnRefresh: true,
        },
        rotationX: 0,
        rotationY: 0,
        scale: 1,
        y: 0,
        opacity: 1,
        ease: "none",
      });
    },
    { scope: containerRef },
  );

  return (
    <section
      ref={containerRef}
      id="showcase"
      className="relative py-28 px-6 bg-white dark:bg-neutral-950"
    >
      <div className="max-w-6xl mx-auto text-center mb-14">
        <h2 className="[font-family:var(--font-pdf-montserrat)] text-4xl md:text-6xl font-semibold tracking-[-0.03em] mb-6 text-black dark:text-white showcase-heading">
          Um painel para decidir rápido
        </h2>
        <p className="[font-family:var(--font-pdf-inter)] text-black/65 dark:text-white/70 text-lg md:text-[1.15rem] leading-relaxed max-w-3xl mx-auto showcase-heading">
          A visualização operacional da ProOps reúne dados financeiros,
          andamento comercial e prioridades do time para decisões rápidas no
          dia a dia.
        </p>
      </div>

      <div className="max-w-6xl mx-auto">
        <div style={{ perspective: "2000px" }}>
          <div
            id="dashboard-mockup"
            className="showcase-mockup relative rounded-2xl border border-black/15 dark:border-white/15 bg-white dark:bg-neutral-900 shadow-[0_20px_60px_rgba(0,0,0,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden will-change-transform"
          >
            <div className="h-12 border-b border-black/10 dark:border-white/10 flex items-center px-6 gap-2 bg-black/[0.015] dark:bg-white/[0.02]">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-black/15 dark:bg-white/15" />
                <div className="w-3 h-3 rounded-full bg-black/15 dark:bg-white/15" />
                <div className="w-3 h-3 rounded-full bg-black/15 dark:bg-white/15" />
              </div>
              <div className="mx-auto px-4 py-1 rounded-md bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 text-xs text-black/55 dark:text-white/55 font-mono flex items-center gap-2">
                <Lock className="w-3 h-3" />
                proops.com.br
              </div>
            </div>

            <div className="aspect-[16/9] bg-white dark:bg-neutral-900 relative overflow-hidden group">
              <Image
                src="/hero/Dashboard.png"
                alt="Dashboard real da ProOps com visão financeira e operacional"
                width={1920}
                height={944}
                className="w-full h-full object-cover object-left-top transition-transform duration-700 group-hover:scale-[1.01]"
                priority
              />

              <div className="absolute inset-0 bg-gradient-to-t from-white/35 dark:from-black/45 via-transparent to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

