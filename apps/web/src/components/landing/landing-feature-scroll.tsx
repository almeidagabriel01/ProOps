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
    src: "/features/Lia.mp4",
  },
  {
    title: "Gestão financeira completa",
    description:
      "Receitas, despesas, carteiras e parcelamentos em um só lugar. Acompanhe o fluxo de caixa, a projeção de balanço futuro e os pagamentos atrasados com filtros que deixam tudo à mão.",
    src: "/features/Financeiro.mp4",
  },
  {
    title: "Proposta pronta, PDF na hora",
    description:
      "Finalize o preenchimento da proposta e visualize o PDF profissional instantaneamente. Personalize o template, envie ao cliente e acompanhe o status de aprovação sem sair da plataforma.",
    src: "/features/PDF.mp4",
  },
];

const SECTION_HEADING = (
  <h2 className="text-center text-4xl font-bold tracking-tight text-black dark:text-white md:text-5xl lg:text-6xl">
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
 * (texto + barra lateral) e fazem crossfade entre os vídeos, que tocam em loop.
 * Clicar num item rola direto para a etapa correspondente.
 *
 * Desktop + motion-safe: pin via ScrollTrigger. Mobile ou prefers-reduced-motion:
 * versão estática empilhada (CSS `md:motion-safe:` decide qual renderiza).
 */
export function LandingFeatureScroll() {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [active, setActive] = useState(0);

  // Play em loop no vídeo ativo, pause nos demais (crossfade fica por conta do CSS)
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

  // Clique num item rola até a posição de scroll da etapa correspondente
  const jumpTo = useCallback((index: number) => {
    const section = sectionRef.current;
    if (!section) return;
    const distance = section.offsetHeight - window.innerHeight;
    const top = section.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + (index / 2) * distance, behavior: "smooth" });
  }, []);

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
          className="flex h-screen flex-col items-center justify-center gap-14 px-6"
        >
          {SECTION_HEADING}

          <div className="mx-auto grid w-full max-w-[88rem] grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-stretch gap-16 lg:gap-24">
            {/* Coluna esquerda: itens com barra lateral por item */}
            <div className="relative">
              {/* trilho contínuo */}
              <div className="absolute left-0 top-0 h-full w-px bg-black/20 dark:bg-white/20" />

              <div className="flex h-full flex-col justify-between gap-10 py-2">
                {FEATURES.map((feature, i) => (
                  <button
                    key={feature.title}
                    type="button"
                    onClick={() => jumpTo(i)}
                    aria-current={i === active}
                    className="relative cursor-pointer pl-8 text-left"
                  >
                    {/* segmento da barra: cobre a altura inteira do item ativo */}
                    <span
                      aria-hidden
                      className={`absolute inset-y-0 left-0 w-px bg-black/80 transition-opacity duration-[400ms] ease-out dark:bg-white/80 ${
                        i === active ? "opacity-100" : "opacity-0"
                      }`}
                    />
                    <h3
                      className={`text-2xl font-semibold transition-opacity duration-300 ease-out lg:text-[1.7rem] ${
                        i === active
                          ? "text-black opacity-100 dark:text-white"
                          : "text-black opacity-60 hover:opacity-80 dark:text-white"
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
                        <p className="pt-3 text-base leading-relaxed text-black/65 dark:text-white/65">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Coluna direita: quadro de vídeo com crossfade */}
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-black/10 bg-neutral-100 shadow-xl shadow-black/5 dark:border-white/10 dark:bg-neutral-900 dark:shadow-black/30">
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
                  suppressHydrationWarning
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
              <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-black/10 bg-neutral-100 shadow-lg shadow-black/5 dark:border-white/10 dark:bg-neutral-900 dark:shadow-black/30">
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
      suppressHydrationWarning
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}
