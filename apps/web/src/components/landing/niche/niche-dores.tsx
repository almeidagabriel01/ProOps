import React from "react";
import { Check } from "lucide-react";

import { Accent } from "../_shared/section-heading";
import type { NicheLandingConfig } from "./types";

/**
 * O jeito antigo e o jeito na ProOps, em pares. O antigo leva um risco que
 * corre com a rolagem (`.dor-riscado`, CSS guiado pelo scroll), linha a linha;
 * onde o navegador não sabe animar pela rolagem, o risco já está lá.
 */
export function NicheDores({ dores }: { dores: NicheLandingConfig["dores"] }) {
  return (
    <section className="border-t border-black/10 bg-white py-24 dark:border-white/10 dark:bg-neutral-950 md:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2 className="max-w-3xl [font-family:var(--font-pdf-montserrat)] text-[2.1rem] font-bold leading-[1.06] tracking-[-0.025em] text-black dark:text-white md:text-5xl">
          O que sai da planilha e do <Accent>papel</Accent>.
        </h2>
        <ol className="mt-14 border-b border-black/10 dark:border-white/10">
          {dores.map((dor) => (
            <li
              key={dor.antes}
              className="vt-revela grid gap-4 border-t border-black/10 py-8 dark:border-white/10 md:grid-cols-2 md:gap-12"
            >
              <p className="text-[17px] leading-relaxed text-black/45 dark:text-white/45">
                <span className="dor-riscado">{dor.antes}</span>
              </p>
              <p className="flex items-start gap-3 text-[17px] font-medium leading-relaxed text-black dark:text-white">
                <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--acento)] text-white dark:text-black">
                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                </span>
                {dor.depois}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
