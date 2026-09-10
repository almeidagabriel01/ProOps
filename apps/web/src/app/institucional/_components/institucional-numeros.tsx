"use client";

import React from "react";

import { NumerosScrubados } from "@/components/institucional/numeros-scrubados";
import { PlaceholderBadge } from "@/components/institucional/placeholder-badge";
import { Realce, TituloSecao } from "@/components/institucional/secao";

import { NUMEROS } from "../_content/institucional-copy";

/**
 * The figures, counted by the reader's own scroll.
 *
 * Split out of the closing CTA, where they used to live. They were sharing a
 * screen with the two buttons that end the page, which meant the last thing the
 * reader saw was a wall of "00" next to a call to action: the weakest possible
 * pairing. Alone, on a light screen between two dark ones, they read as a pause
 * before the ending rather than as a caveat attached to it.
 */
export function InstitucionalNumeros() {
  return (
    <section
      aria-label="A ProOps em números"
      className="relative isolate overflow-hidden border-t border-black/10 bg-white px-6 py-24 text-black md:px-10 md:py-32"
    >
      <div
        aria-hidden="true"
        className="campo-reativo campo-reativo--claro pointer-events-none"
      />
      <div className="relative z-10 mx-auto max-w-6xl">
        <PlaceholderBadge>números a confirmar</PlaceholderBadge>
        <TituloSecao
          tom="claro"
          sobrancelha="Em números"
          titulo={
            <>
              O que dá para <Realce>contar</Realce>.
            </>
          }
          className="mb-14"
        />
        <NumerosScrubados tom="claro" numeros={NUMEROS} />
      </div>
    </section>
  );
}
