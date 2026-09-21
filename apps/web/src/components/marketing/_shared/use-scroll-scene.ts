"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/** Desktop only, and only for visitors who did not ask for less movement. */
export const SCENE_DESKTOP =
  "(min-width: 768px) and (prefers-reduced-motion: no-preference)";
/** Any width, still respecting the motion preference. */
export const SCENE_ANY_WIDTH = "(prefers-reduced-motion: no-preference)";

/**
 * O complemento exato de `SCENE_DESKTOP`: onde uma cena de desktop NÃO é
 * montada (abaixo de `md`, ou com movimento reduzido).
 *
 * Derivado, e não reescrito à mão, porque é usado para decidir onde é seguro
 * adiar a hidratação de uma seção com `pin` (ver `HidratarPerto`). Uma cópia
 * que andasse sozinha adiaria justamente onde o pin existe.
 */
export const OUTSIDE_SCENE_DESKTOP = `not all and ${SCENE_DESKTOP}`;

/**
 * `toggleActions` de uma revelação que acontece TODA vez que o leitor chega.
 *
 * A ordem é onEnter, onLeave, onEnterBack, onLeaveBack. `restart` na entrada e
 * `reset` ao sair por cima: descer revela, subir de volta devolve a cena ao
 * estado inicial, e descer de novo revela de novo.
 *
 * Isto substituiu `once: true` em toda cena de revelação do site da empresa.
 * O argumento a favor do `once` era que texto que volta a apagar quando alguém
 * sobe para reler é hostil; o argumento contra, que ganhou, é que numa página
 * inteira construída sobre movimento uma seção que não responde mais parece
 * quebrada, e o leitor não sabe que ela "já tocou". Uma cena só toca enquanto
 * está FORA de vista na volta, então ninguém vê texto apagar debaixo do olho.
 *
 * Cena com `scrub` não usa isto: ela já é reversível por construção.
 */
export const CENA_REPETE = "restart none none reset";

interface ScrollSceneOptions {
  /** Media query the scene is built under. Defaults to desktop only. */
  query?: string;
  /** Re-run when these change, same contract as useGSAP's dependencies. */
  dependencies?: unknown[];
}

/**
 * The house pattern for a scroll-driven section, in one place.
 *
 * Every animated section on the ERP landing repeats the same five lines:
 * register ScrollTrigger, open a `gsap.matchMedia()`, add a query that carries
 * `prefers-reduced-motion: no-preference`, build the timeline, revert on
 * teardown. Copied thirteen times, it drifts: a section that forgets the
 * motion-preference half of the query animates for someone who asked it not
 * to, and nothing fails.
 *
 * `useGSAP` with a `scope` already reverts on unmount; the explicit
 * `mm.revert()` covers the other case, crossing the media query at runtime
 * (resizing past 768px, or toggling the device toolbar), where the old
 * timeline would otherwise keep its transforms.
 *
 * Under `reduce`, no timeline is ever created and the DOM keeps whatever the
 * server rendered. That is why sections must be authored in their FINAL state
 * and animated with `fromTo`, never with `to` from an invisible start.
 *
 * Callers import `gsap` and `ScrollTrigger` themselves, as the thirteen
 * existing sections do. Registering the plugin here means they never have to
 * remember to.
 *
 * A scene may return a cleanup function, which runs when the media query stops
 * matching or the component unmounts.
 */
export function useScrollScene(
  scope: React.RefObject<HTMLElement | null>,
  build: () => void | (() => void),
  { query = SCENE_DESKTOP, dependencies = [] }: ScrollSceneOptions = {},
) {
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      // The return value is forwarded: gsap.matchMedia calls a scene's
      // cleanup on revert, which is the only way to undo properties written
      // per frame with a quickSetter, since those bypass gsap's own recording
      // and would otherwise stay stuck on the element below the breakpoint.
      mm.add(query, () => build());
      return () => {
        mm.revert();
      };
    },
    { scope, dependencies },
  );
}
