"use client";

import { useEffect, useRef } from "react";

import { useReducedMotion } from "@/components/landing/_shared/use-reduced-motion";
import { useMediaQuery } from "./use-media-query";

const PONTEIRO_FINO = "(pointer: fine)";

/**
 * A light that follows the cursor across a group of cards.
 *
 * Attach the ref to the CONTAINER, not to each card: one listener for a grid of
 * six beats six listeners, and the shared listener is also what lets the light
 * cross from one card to the next as a single moving thing instead of appearing
 * and disappearing per box.
 *
 * It writes `--mx` and `--my` in percent on the hovered card, and toggles
 * `data-aceso` on it. The card styles itself off those, so the reactive part
 * stays in CSS and React never re-renders for a mouse move.
 *
 * The write is coalesced into one rAF: `pointermove` fires faster than the
 * screen refreshes, and writing a custom property per event is layout thrash for
 * frames nobody sees.
 *
 * Nothing is attached under `prefers-reduced-motion` or on a touch screen, where
 * there is no cursor to follow and the light would only ever be stuck wherever
 * the last tap landed.
 */
export function useHolofote<T extends HTMLElement>(
  seletor = "[data-holofote]",
) {
  const ref = useRef<T>(null);
  const reduce = useReducedMotion();
  const temPonteiro = useMediaQuery(PONTEIRO_FINO);

  useEffect(() => {
    if (reduce || !temPonteiro) return;
    const raiz = ref.current;
    if (!raiz) return;

    let frame = 0;
    let alvo: HTMLElement | null = null;
    let x = 0;
    let y = 0;

    const escreve = () => {
      frame = 0;
      if (!alvo) return;
      alvo.style.setProperty("--mx", `${x}%`);
      alvo.style.setProperty("--my", `${y}%`);
    };

    const onMove = (event: PointerEvent) => {
      const card = (event.target as HTMLElement | null)?.closest<HTMLElement>(
        seletor,
      );
      if (card !== alvo) {
        alvo?.removeAttribute("data-aceso");
        alvo = card ?? null;
        alvo?.setAttribute("data-aceso", "");
      }
      if (!alvo) return;
      const box = alvo.getBoundingClientRect();
      x = ((event.clientX - box.left) / box.width) * 100;
      y = ((event.clientY - box.top) / box.height) * 100;
      if (!frame) frame = requestAnimationFrame(escreve);
    };

    const onLeave = () => {
      alvo?.removeAttribute("data-aceso");
      alvo = null;
    };

    raiz.addEventListener("pointermove", onMove, { passive: true });
    raiz.addEventListener("pointerleave", onLeave, { passive: true });

    return () => {
      raiz.removeEventListener("pointermove", onMove);
      raiz.removeEventListener("pointerleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
      // Written outside React's and gsap's bookkeeping, so nothing else clears
      // them: a stale light would survive a breakpoint change.
      raiz.querySelectorAll<HTMLElement>(seletor).forEach((card) => {
        card.removeAttribute("data-aceso");
        card.style.removeProperty("--mx");
        card.style.removeProperty("--my");
      });
    };
  }, [reduce, temPonteiro, seletor]);

  return ref;
}
