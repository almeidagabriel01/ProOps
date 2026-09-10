"use client";

import React, { useEffect, useState } from "react";

/** 0, 25, 50, 75, 100. Five frames is enough to read as counting. */
const QUADROS = [0, 25, 50, 75, 100];
const LAMINAS = 6;

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
 * The opening: six slats lift off a black screen while a counter runs.
 *
 * A Server Component, and entirely CSS. That is the whole design constraint of
 * this scene: an opening sequence is the one thing on the page that must not
 * wait for JavaScript, because it plays during the exact window in which the
 * bundle is still arriving. A React-driven curtain would hold the screen black
 * until hydration and then animate, which on a throttled phone means several
 * seconds of nothing followed by a flourish nobody was waiting for any more.
 *
 * It is `fixed`, so it contributes no layout and cannot shift anything (CLS is a
 * hard CI failure on this page). It is `pointer-events-none` from the first
 * frame, so it never swallows a click even while it is still on screen, and it
 * has no JavaScript to remove it: the slats end at `scaleY(0)`, so once the
 * animation is over there is nothing to see and nothing to clean up.
 *
 * The slats are the same gesture as the page transition between the company
 * site's pages, deliberately: entering the site and moving inside it should read
 * as one mechanism rather than two effects. Which is exactly why it plays ONCE
 * per document: coming back to the root from a sub-page already draws the
 * curtain, and replaying the opening on top of it reads as the same effect
 * stuttering twice.
 *
 * Under `prefers-reduced-motion` globals.css pins the slats at `scaleY(0)` and
 * the counter at its last frame, so the page simply opens.
 */
export function InstitucionalAbertura() {
  // On the server this is always true, so the markup is in the HTML and the CSS
  // plays at first paint; on the client's first render `jaAbriu` is still false,
  // so hydration matches. Only a later client-side navigation reads `true`.
  const [mostrar] = useState(
    () => typeof window === "undefined" || !jaAbriu,
  );

  useEffect(() => {
    jaAbriu = true;
  }, []);

  if (!mostrar) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[100]"
    >
      <div className="absolute inset-0 flex">
        {Array.from({ length: LAMINAS }).map((_, index) => (
          <div
            key={index}
            className="abertura-lamina h-full flex-1 bg-neutral-950"
            style={
              {
                // Left to right, and slower than the counter so the number is
                // readable before the screen opens on it.
                "--lamina-delay": `${0.95 + index * 0.055}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className="absolute inset-x-0 bottom-10 flex justify-center px-6 md:bottom-14">
        {/* Fades in, holds, and fades out WITH the slats: see
            `abertura-rotulo` in globals.css. */}
        <div className="abertura-rotulo flex items-baseline gap-3 [font-family:var(--font-geist-mono)] text-white/70">
          <span className="text-[11px] uppercase tracking-[0.3em]">
            ProOps
          </span>
          {/*
            The odometer window. `h-[1em]` with `overflow-hidden` shows exactly
            one frame, and `tabular-nums` keeps the three-digit frame from being
            wider than the one-digit ones, which would make the window twitch.
          */}
          <span className="block h-[1em] overflow-hidden text-[11px] leading-[1em] tabular-nums">
            <span
              className="abertura-tira block"
              style={
                {
                  "--abertura-passos": QUADROS.length - 1,
                } as React.CSSProperties
              }
            >
              {QUADROS.map((n) => (
                <span key={n} className="block h-[1em] leading-[1em]">
                  {n}
                </span>
              ))}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
