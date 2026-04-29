"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import type { NicheLandingConfig } from "./types";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface NicheFeaturesProps {
  features: NicheLandingConfig["features"];
}

export function NicheFeatures({ features }: NicheFeaturesProps) {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = containerRef.current;
      if (!section) return;

      section.querySelectorAll<HTMLElement>(".niche-features-heading").forEach((el) => {
        gsap.fromTo(
          el,
          { y: 22, opacity: 0, autoAlpha: 0 },
          {
            y: 0,
            opacity: 1,
            autoAlpha: 1,
            ease: "none",
            scrollTrigger: {
              trigger: el,
              start: "top 94%",
              end: "top 68%",
              scrub: true,
              invalidateOnRefresh: true,
            },
          },
        );
      });

      section.querySelectorAll<HTMLElement>(".niche-feature-card").forEach((card) => {
        gsap.fromTo(
          card,
          { y: 26, opacity: 0, autoAlpha: 0 },
          {
            y: 0,
            opacity: 1,
            autoAlpha: 1,
            ease: "none",
            scrollTrigger: {
              trigger: card,
              start: "top 98%",
              end: "top 70%",
              scrub: true,
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
      className="relative border-t border-black/10 bg-black/[0.015] py-28 dark:border-white/10 dark:bg-white/[0.03]"
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 text-center">
          <h2 className="niche-features-heading mb-3 text-sm font-semibold uppercase tracking-wider text-black/70 dark:text-white/70">
            Recursos da Plataforma
          </h2>
          <h3 className="niche-features-heading mx-auto mb-6 max-w-4xl text-4xl font-bold text-black dark:text-white md:text-5xl">
            Tudo que sua empresa precisa para operar.
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <div key={title} className="niche-feature-card relative rounded-2xl">
              <div className="pointer-events-none absolute -inset-px rounded-2xl bg-[conic-gradient(from_0deg,rgba(0,0,0,0)_0deg,rgba(0,0,0,0.08)_120deg,rgba(0,0,0,0)_240deg,rgba(0,0,0,0)_360deg)] dark:bg-[conic-gradient(from_0deg,rgba(255,255,255,0)_0deg,rgba(255,255,255,0.12)_120deg,rgba(255,255,255,0)_240deg,rgba(255,255,255,0)_360deg)] opacity-50 animate-spin-slow" />
              <div className="card-shine-on-hover group relative rounded-2xl border border-black/10 bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(0,0,0,0.12)] dark:border-white/10 dark:bg-neutral-900 dark:hover:shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
                <div className="relative z-10">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg border border-black/10 bg-black/[0.04] transition-transform duration-300 group-hover:scale-105 dark:border-white/10 dark:bg-white/[0.08]">
                    <Icon className="h-5 w-5 text-black dark:text-white" />
                  </div>
                  <h4 className="mb-3 text-xl font-semibold text-black dark:text-white">
                    {title}
                  </h4>
                  <p className="text-sm leading-relaxed text-black/65 dark:text-white/70">
                    {description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
