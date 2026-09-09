"use client";

import React from "react";
import Image from "next/image";
import gsap from "gsap";

import { useScrollScene } from "@/components/marketing/_shared/use-scroll-scene";
import { APP_NAME } from "@/lib/site/app-brand";

import { DeviceFrame } from "./device-frame";

interface Tela {
  nome: string;
  descricao: string;
  plataforma: "ios" | "android";
  imagem: string;
}

/**
 * The real screens, as proof.
 *
 * The hero rebuilds one screen in HTML because it has to move. This is the
 * opposite job, and only actual captures do it. They come from the app's
 * `design-preview` route, which renders the real screens with sample data and
 * no login.
 *
 * A shelf rather than a grid: six screens in a four-up grid leaves a ragged
 * second row, and shrinking them to fit six across makes each one unreadable.
 *
 * Above `md` the section pins and the vertical scroll drags the shelf
 * sideways, so the screens pass by as you keep scrolling down instead of
 * asking for a second, horizontal gesture. Below `md`, and for anyone who
 * asked for less movement, the same markup falls back to a native
 * snap-scrolling row: a pinned track is the wrong thing on a touch screen,
 * where swiping sideways is natural and hijacking the page scroll is not.
 *
 * The distance is measured from the track, so adding a seventh screen extends
 * the scroll on its own rather than cutting the last one off.
 */
const TELAS: Tela[] = [
  {
    nome: "Hoje",
    descricao: "Sobra projetada, vencimentos e o que a IA capturou",
    plataforma: "ios",
    imagem: "/mockup-ios/hoje.jpg",
  },
  {
    nome: "Financeiro",
    descricao: "O mês inteiro, com saldo projetado",
    plataforma: "ios",
    imagem: "/mockup-ios/financeiro.jpg",
  },
  {
    nome: "Lançamentos",
    descricao: "Busca, filtros e a origem de cada linha",
    plataforma: "ios",
    imagem: "/mockup-ios/financeiro2.jpg",
  },
  {
    nome: "Agenda",
    descricao: "Lembretes, com recorrência",
    plataforma: "ios",
    imagem: "/mockup-ios/agenda.jpg",
  },
  {
    nome: "Notas",
    descricao: "Pastas, tags e checklist",
    plataforma: "ios",
    imagem: "/mockup-ios/notas.jpg",
  },
  {
    nome: "Perfil",
    descricao: "WhatsApp conectado e a cota de IA por canal",
    plataforma: "ios",
    imagem: "/mockup-ios/perfil.jpg",
  },
];

export function AplicativoGaleria() {
  const sectionRef = React.useRef<HTMLElement>(null);
  const trackRef = React.useRef<HTMLUListElement>(null);

  useScrollScene(sectionRef, () => {
    const track = trackRef.current;
    if (!track) return;

    const distance = () => Math.max(track.scrollWidth - window.innerWidth, 0);

    gsap.to(track, {
      x: () => -distance(),
      ease: "none",
      scrollTrigger: {
        trigger: sectionRef.current,
        start: "top top",
        // Six screens at a readable size can already fit a wide monitor.
        // Deriving the pin length from the real distance means the section
        // simply does not steal scroll when there is nothing to pan.
        end: () => `+=${Math.max(distance(), 1)}`,
        pin: true,
        scrub: 0.6,
        invalidateOnRefresh: true,
      },
    });
  });

  return (
    <section
      ref={sectionRef}
      className="border-t border-white/[0.06] bg-[var(--app-bg)] py-28 text-[var(--app-text)] md:py-0"
    >
      {/* Full-bleed shelf: the row runs past the container so the last screen
          is cut by the viewport edge rather than by a margin, which is what
          reads as "there is more" instead of "this is the end". */}
      <div className="md:h-[100svh] md:overflow-hidden">
        <div className="md:flex md:h-full md:flex-col md:justify-center">
          {/* Padding on the wrapper and the cap on the block inside, which is
              how every other section on this page is built. Getting it the
              other way round shifts this heading 40px off the shared margin. */}
          <div className="px-6 md:px-10">
            <div className="mx-auto w-full max-w-5xl">
              <p className="mb-4 inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--app-tint)]">
                <span className="h-px w-7 bg-[var(--app-tint)]/50" />
                Por dentro
              </p>
              <h2 className="max-w-2xl [font-family:var(--font-hanken)] text-3xl font-bold leading-[1.1] tracking-[-0.02em] md:text-5xl">
                O {APP_NAME}, tela por tela.
              </h2>
            </div>
          </div>

          <ul
            ref={trackRef}
            className="landing-scrollbar mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-8 md:mt-14 md:w-max md:snap-none md:overflow-visible md:px-10 md:pb-0"
          >
            {TELAS.map((tela, index) => (
              <li
                key={tela.nome}
                className="w-[52%] shrink-0 snap-start sm:w-[33%] md:w-[14rem] lg:w-[18rem]"
              >
                <DeviceFrame platform={tela.plataforma}>
                  <Image
                    src={tela.imagem}
                    alt={`Tela ${tela.nome} do ${APP_NAME}: ${tela.descricao}`}
                    fill
                    sizes="(min-width: 1024px) 18rem, (min-width: 768px) 14rem, 52vw"
                    loading={index < 2 ? "eager" : "lazy"}
                    className="object-cover"
                  />
                </DeviceFrame>
                <p className="mt-4 [font-family:var(--font-hanken)] text-sm font-semibold">
                  {tela.nome}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--app-text-muted)]">
                  {tela.descricao}
                </p>
              </li>
            ))}

            {/*
              The shelf ends somewhere instead of trailing off. This also earns
              the pan its length honestly: six screens at a readable size
              already fit a wide monitor, and padding the track with empty
              space to force movement would be moving nothing.
            */}
            <li className="flex w-[52%] shrink-0 snap-start items-center sm:w-[33%] md:w-[14rem] lg:w-[18rem]">
              <a
                href="#lista-de-espera"
                className="flex aspect-[9/19.5] w-full flex-col justify-center rounded-[1.75rem] border border-dashed border-white/15 px-6 text-center transition-colors hover:border-[var(--app-tint)]/50 hover:bg-white/[0.02]"
              >
                <span className="[font-family:var(--font-hanken)] text-lg font-bold leading-tight text-[var(--app-text)]">
                  Quer ver de perto?
                </span>
                <span className="mt-3 text-sm leading-relaxed text-[var(--app-text-muted)]">
                  Deixe seu e-mail e avisamos quando abrir.
                </span>
                <span className="mt-5 text-sm font-semibold text-[var(--app-tint)]">
                  Entrar na lista
                </span>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
