"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { CheckCircle2 } from "lucide-react";
import type { NicheLandingConfig } from "./types";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface NicheModulesProps {
  modules: NicheLandingConfig["modules"];
  sectionTitle: string;
  sectionSubtitle: string;
}

export function NicheModules({ modules, sectionTitle, sectionSubtitle }: NicheModulesProps) {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = containerRef.current;
      if (!section) return;

      section.querySelectorAll<HTMLElement>(".niche-module-heading").forEach((el) => {
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

      section.querySelectorAll<HTMLElement>(".niche-module-card").forEach((el) => {
        gsap.fromTo(
          el,
          { y: 32, opacity: 0, autoAlpha: 0 },
          {
            y: 0,
            opacity: 1,
            autoAlpha: 1,
            duration: 1.05,
            ease: "power3.out",
            scrollTrigger: {
              trigger: el,
              start: "top 94%",
              end: "bottom 50%",
              toggleActions: "play none none reverse",
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
      className="border-y border-black/10 bg-white py-24 dark:border-white/10 dark:bg-neutral-950"
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 text-center">
          <h2 className="niche-module-heading mb-3 text-sm font-semibold uppercase tracking-wider text-black/70 dark:text-white/70">
            Módulos Específicos
          </h2>
          <h3 className="niche-module-heading mx-auto mb-4 max-w-3xl text-4xl font-bold text-black dark:text-white md:text-5xl">
            {sectionTitle}
          </h3>
          <p className="niche-module-heading mx-auto max-w-2xl text-lg text-black/60 dark:text-white/60">
            {sectionSubtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {modules.map(({ icon: Icon, title, description, bullets }) => (
            <div key={title} className="niche-module-card relative rounded-2xl">
              <div className="pointer-events-none absolute -inset-px rounded-2xl bg-[conic-gradient(from_0deg,rgba(0,0,0,0)_0deg,rgba(0,0,0,0.08)_120deg,rgba(0,0,0,0)_240deg,rgba(0,0,0,0)_360deg)] dark:bg-[conic-gradient(from_0deg,rgba(255,255,255,0)_0deg,rgba(255,255,255,0.12)_120deg,rgba(255,255,255,0)_240deg,rgba(255,255,255,0)_360deg)] opacity-50 animate-spin-slow" />
            <div
              className="card-shine-on-hover group relative rounded-2xl border border-black/10 bg-black/[0.015] p-8 transition-all duration-300 hover:-translate-y-1 hover:border-black/20 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20 dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-black/10 bg-white transition-transform duration-300 group-hover:scale-105 dark:border-white/10 dark:bg-neutral-900">
                <Icon className="h-6 w-6 text-black dark:text-white" />
              </div>
              <h4 className="mb-3 text-xl font-bold text-black dark:text-white">
                {title}
              </h4>
              <p className="mb-5 text-sm leading-relaxed text-black/60 dark:text-white/60">
                {description}
              </p>
              <ul className="space-y-2.5">
                {bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="flex items-start gap-2.5 text-sm text-black/75 dark:text-white/75"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-black dark:text-white" />
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
