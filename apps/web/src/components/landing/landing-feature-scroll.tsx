"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface FeatureItem {
  title: string;
  description: string;
  src: string;
}

const FEATURES: FeatureItem[] = [
  {
    title: "Automação com IA",
    description:
      "A Lia, assistente de IA da ProOps, responde sobre seu negócio em segundos: faturamento, pendências e próximos passos. Ela também preenche formulários e automatiza tarefas repetitivas para você focar no que importa.",
    src: "/features/feature-1.webm",
  },
  {
    title: "Gestão financeira completa",
    description:
      "Receitas, despesas, carteiras e parcelamentos em um só lugar. Acompanhe o fluxo de caixa, a projeção de balanço futuro e os pagamentos atrasados com filtros que deixam tudo à mão.",
    src: "/features/feature-2.webm",
  },
  {
    title: "Proposta pronta, PDF na hora",
    description:
      "Finalize o preenchimento da proposta e visualize o PDF profissional instantaneamente. Personalize o template, envie ao cliente e acompanhe o status de aprovação sem sair da plataforma.",
    src: "/features/feature-3.webm",
  },
];

const SECTION_HEADING = (
  <h2 className="text-center text-4xl font-bold tracking-tight text-black dark:text-white md:text-5xl">
    Conheça a{" "}
    <em className="[font-family:var(--font-pdf-playfair)] font-medium italic">
      plataforma
    </em>{" "}
    ProOps
  </h2>
);

/**
 * Seção "feature scroll" com pin: o conteúdo fica fixo enquanto o usuário rola
 * ~2.5x a viewport; o progresso é dividido em 3 etapas que trocam o item ativo
 * (texto + barra de progresso) e fazem crossfade entre os vídeos.
 *
 * Desktop + motion-safe: pin via ScrollTrigger. Mobile ou prefers-reduced-motion:
 * versão estática empilhada (CSS `md:motion-safe:` decide qual renderiza).
 */
export function LandingFeatureScroll() {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [indicator, setIndicator] = useState({ top: 0, height: 0 });

  // Posiciona o segmento da barra de progresso alinhado ao item ativo
  const updateIndicator = useCallback((index: number) => {
    const list = listRef.current;
    const item = itemRefs.current[index];
    if (!list || !item) return;
    const listBox = list.getBoundingClientRect();
    const itemBox = item.getBoundingClientRect();
    setIndicator({ top: itemBox.top - listBox.top, height: itemBox.height });
  }, []);

  useEffect(() => {
    updateIndicator(active);
  }, [active, updateIndicator]);

  useEffect(() => {
    const onResize = () => updateIndicator(active);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [active, updateIndicator]);

  // Play no vídeo ativo, pause nos demais (crossfade fica por conta do CSS)
  useEffect(() => {
    videoRefs.current.forEach((video, i) => {
      if (!video) return;
      if (i === active) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, [active]);

  useGSAP(
    () => {
      const section = sectionRef.current;
      const pinned = pinRef.current;
      if (!section || !pinned) return;

      const mm = gsap.matchMedia();

      mm.add(
        "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
        () => {
          let lastIndex = -1;

          ScrollTrigger.create({
            trigger: section,
            pin: pinned,
            pinSpacing: false, // a altura da própria section (250vh) já cria a distância de scroll
            start: "top top",
            end: "bottom bottom",
            anticipatePin: 1,
            invalidateOnRefresh: true,
            // snap discreto entre as 3 etapas — troca de estado, não scrub contínuo
            snap: {
              snapTo: 1 / 2,
              duration: { min: 0.2, max: 0.45 },
              ease: "power1.inOut",
            },
            onUpdate: (self) => {
              // round(p*2) centraliza cada etapa nos pontos de snap (0, 0.5, 1)
              const index = Math.round(self.progress * 2);
              if (index !== lastIndex) {
                lastIndex = index;
                setActive(index);
              }
            },
          });
        }
      );

      return () => mm.revert();
    },
    { scope: sectionRef }
  );

  return (
    <>
      {/* ===== Desktop (motion-safe): seção pinada ===== */}
      <section
        ref={sectionRef}
        aria-label="Conheça a plataforma ProOps"
        className="relative hidden h-[250vh] md:motion-safe:block"
      >
        <div
          ref={pinRef}
          className="flex h-screen flex-col items-center justify-center gap-12 px-6"
        >
          {SECTION_HEADING}

          <div className="mx-auto grid w-full max-w-6xl grid-cols-2 items-center gap-14">
            {/* Coluna esquerda: barra de progresso + itens */}
            <div ref={listRef} className="relative pl-7">
              {/* trilho */}
              <div className="absolute left-0 top-0 h-full w-px bg-black/20 dark:bg-white/20" />
              {/* segmento ativo */}
              <div
                className="absolute left-0 w-px bg-black/80 transition-[top,height] duration-[400ms] ease-out dark:bg-white/80"
                style={{ top: indicator.top, height: indicator.height }}
              />

              <div className="flex flex-col gap-9">
                {FEATURES.map((feature, i) => (
                  <div
                    key={feature.title}
                    ref={(el) => {
                      itemRefs.current[i] = el;
                    }}
                  >
                    <h3
                      className={`text-xl font-semibold transition-opacity duration-300 ease-out ${
                        i === active
                          ? "text-black opacity-100 dark:text-white"
                          : "text-black opacity-60 dark:text-white"
                      }`}
                    >
                      {feature.title}
                    </h3>
                    <div
                      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                        i === active
                          ? "grid-rows-[1fr] opacity-100"
                          : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <p className="pt-2 text-sm leading-relaxed text-black/65 dark:text-white/65">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Coluna direita: quadro de vídeo com crossfade */}
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-black/10 bg-neutral-100 shadow-xl shadow-black/5 dark:border-white/10 dark:bg-neutral-900 dark:shadow-black/30">
              {FEATURES.map((feature, i) => (
                <video
                  key={feature.src}
                  ref={(el) => {
                    videoRefs.current[i] = el;
                  }}
                  src={feature.src}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-hidden={i !== active}
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[450ms] ease-out ${
                    i === active ? "opacity-100" : "opacity-0"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== Mobile ou prefers-reduced-motion: versão estática empilhada ===== */}
      <section
        aria-label="Conheça a plataforma ProOps"
        className="block px-6 py-24 md:motion-safe:hidden"
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-16">
          {SECTION_HEADING}

          {FEATURES.map((feature) => (
            <div key={feature.title} className="flex flex-col gap-5">
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-black/10 bg-neutral-100 shadow-lg shadow-black/5 dark:border-white/10 dark:bg-neutral-900 dark:shadow-black/30">
                <StaticVideo src={feature.src} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-black dark:text-white">
                  {feature.title}
                </h3>
                <p className="pt-2 text-sm leading-relaxed text-black/65 dark:text-white/65">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

interface StaticVideoProps {
  src: string;
}

/**
 * Vídeo da versão estática: toca em loop apenas enquanto visível na viewport
 * e somente se o usuário não pediu redução de movimento.
 */
function StaticVideo({ src }: StaticVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.35 }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      src={src}
      muted
      loop
      playsInline
      preload="metadata"
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}
