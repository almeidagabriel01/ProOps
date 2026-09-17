"use client";

import React from "react";
import gsap from "gsap";
import { DrawSVGPlugin } from "gsap/dist/DrawSVGPlugin";
import NumberFlow from "@number-flow/react";

import { useScrollProgress } from "@/components/marketing/_shared/use-scroll-progress";
import { APP_NAME } from "@/lib/site/app-brand";

import { useCena } from "./use-cena";
import { useValores } from "./cenas/pecas-da-cena";
import { useVisibilidade } from "./use-visibilidade";

if (typeof window !== "undefined") {
  gsap.registerPlugin(DrawSVGPlugin);
}

const LIMITE = 100;
const USO = { whatsapp: 2, app: 4 };

/**
 * A faixa de cota, que era o fecho da antiga seção "Um agente, dois lugares".
 *
 * Ela diz a única coisa desta página que as pessoas assumem ao contrário: as
 * conversas são separadas, o limite mensal é o mesmo para as duas. O desenho
 * diz isso antes do texto: dois fios, um de cada canal, descem e se juntam numa
 * barra só, e os dois segmentos da barra levam a cor do fio que os trouxe.
 *
 * A barra é linear e honesta: 6 de 100 é pouco, e é para parecer pouco. Os
 * fios desembocam no começo dela, onde os dois segmentos estão.
 */
export function CotaCompartilhada() {
  const { ref, armado } = useVisibilidade<HTMLDivElement>();
  // Curta de propósito: a faixa se monta enquanto entra na tela, e está
  // completa antes de chegar ao meio dela.
  const { progress } = useScrollProgress(ref, {
    start: "top 92%",
    end: "top 48%",
  });
  const [valores, definir] = useValores({ ...USO });
  const total = valores.whatsapp + valores.app;

  useCena(
    ref,
    (tl, { acompanhar }) => {
      const q = gsap.utils.selector(ref);

      tl.fromTo(
        q(".cota-fio"),
        { drawSVG: "0%" },
        {
          drawSVG: "100%",
          duration: 0.9,
          ease: "power2.inOut",
          stagger: 0.12,
        },
        0.1,
      ).fromTo(
        q(".cota-segmento"),
        { scaleX: 0 },
        { scaleX: 1, duration: 0.7, ease: "expo.out", stagger: 0.15 },
        0.9,
      );

      acompanhar((tempo) =>
        definir({
          whatsapp: tempo >= 0.9 ? USO.whatsapp : 0,
          app: tempo >= 1.05 ? USO.app : 0,
        }),
      );

      return () => definir({ ...USO });
    },
    { armado, progresso: progress },
  );

  return (
    <div
      ref={ref}
      className="rounded-[1.75rem] border border-[var(--app-card-border)] bg-[var(--app-surface)] p-6 md:p-8"
    >
      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-center md:gap-12">
        <div>
          <p className="[font-family:var(--font-hanken)] text-xl font-semibold text-[var(--app-text)]">
            Conversas separadas, cota única
          </p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--app-text-muted)]">
            O que você conversa no WhatsApp não se mistura com o que você
            conversa dentro da {APP_NAME}. O limite mensal, sim, é o mesmo para
            os dois.
          </p>
        </div>

        <div>
          <div className="grid grid-cols-2 text-sm">
            <p className="flex items-baseline gap-2 text-[var(--app-text-muted)]">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full bg-[var(--app-tint)]"
              />
              WhatsApp
              <NumberFlow
                value={valores.whatsapp}
                className="font-semibold text-[var(--app-text)] [font-variant-numeric:tabular-nums]"
              />
            </p>
            <p className="flex items-baseline justify-end gap-2 text-[var(--app-text-muted)]">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full bg-[var(--app-text)]/70"
              />
              No app
              <NumberFlow
                value={valores.app}
                className="font-semibold text-[var(--app-text)] [font-variant-numeric:tabular-nums]"
              />
            </p>
          </div>

          <svg
            viewBox="0 0 200 40"
            preserveAspectRatio="none"
            aria-hidden="true"
            className="mt-2 h-10 w-full overflow-visible"
          >
            <path
              className="cota-fio"
              d="M6 0 C6 24, 8 34, 10 40"
              fill="none"
              stroke="var(--app-tint)"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
            <path
              className="cota-fio"
              d="M194 0 C194 30, 40 30, 14 40"
              fill="none"
              stroke="var(--app-text)"
              strokeOpacity={0.6}
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <div className="flex items-center gap-4">
            <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-[var(--app-element)]">
              <span
                style={{ width: `${USO.whatsapp}%` }}
                className="cota-segmento block h-full min-w-2 origin-left bg-[var(--app-tint)]"
              />
              <span
                style={{ width: `${USO.app}%` }}
                className="cota-segmento block h-full min-w-3 origin-left bg-[var(--app-text)]/70"
              />
            </div>
            <p className="shrink-0 [font-family:var(--font-jetbrains-mono)] text-sm text-[var(--app-text)]">
              <NumberFlow value={total} />
              <span className="text-[var(--app-text-muted)]">
                /{LIMITE} no mês
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
