"use client";

import { useEffect, useState } from "react";

import { chegouSobACortina } from "@/components/marketing/_shared/curtain-transition";

/**
 * Whether this document has already played the opening.
 *
 * Module scope, and CLIENT-only by construction: a client module is
 * re-evaluated on every document load, so the flag is false exactly once per
 * visit, and it survives every client-side navigation in between. That is the
 * distinction the scene needs and that a component cannot see on its own.
 *
 * It must never be consulted on the SERVER: module state there is per process
 * and shared across requests, so the first render would set it and every
 * visitor after that would get no opening at all.
 */
let jaAbriu = false;

/**
 * Two components need the same answer, and they must never disagree.
 *
 * `InstitucionalAbertura` uses it to decide whether to render the slats at all.
 * `InstitucionalHero` uses it to decide how long its entrance waits: the hero's
 * delays exist to let the slats clear the screen first, so on a client-side
 * return to the root, where the opening does NOT play, the same delays are
 * over a second of a blank near-black screen after the transition curtain has
 * already lifted. That reads as an entrance that simply did not happen, which
 * is what it looked like before this hook existed.
 *
 * The flag is only flipped in an effect, so every component that calls this in
 * the same render pass gets the same value regardless of tree order.
 */
export function useAberturaVaiTocar(): boolean {
  // On the server this is always true, so the markup is in the HTML and the CSS
  // plays at first paint; on the client's first render `jaAbriu` is still false,
  // so hydration matches. Only a later client-side navigation reads `true`.
  //
  // `chegouSobACortina` cobre o caso que o `jaAbriu` sozinho não vê: a PRIMEIRA
  // visita à raiz pode acontecer por dentro do site, vindo de /sobre. Ali o
  // painel da transição acabou de cobrir a troca, e as lâminas entrariam logo
  // por cima dele. Além de ser o mesmo gesto duas vezes, isso empurra a entrada
  // do herói mais um segundo para a frente, atrás de uma segunda tela preta.
  const [vaiTocar] = useState(
    () => typeof window === "undefined" || (!jaAbriu && !chegouSobACortina()),
  );

  useEffect(() => {
    jaAbriu = true;
  }, []);

  return vaiTocar;
}

/**
 * Seconds the root hero's entrance holds before starting, so it lands as the
 * slats clear instead of under them. Zero when the opening is not playing.
 */
export function esperaDaAbertura(vaiTocar: boolean): number {
  return vaiTocar ? 1 : 0;
}
