"use client";

import React, { useEffect, useState } from "react";

/**
 * The condition under which a WebGL layer is worth its cost.
 *
 * Three clauses, each earning its place:
 *
 * - `min-width: 1024px` — a phone gets the CSS version. This is also what keeps
 *   the shader out of the Lighthouse run, which measures a 412px viewport: the
 *   module is never imported there, so it costs exactly zero TBT on the metric
 *   that fails the build. `/institucional` has a hard 1200ms ceiling and around
 *   400ms of headroom, so "zero" is the only affordable number.
 * - `pointer: fine` — the field reacts to a cursor. On a touch screen there is
 *   nothing to react to, so it would be a GPU loop drawing the same frame.
 * - `prefers-reduced-motion: no-preference` — it is continuous movement.
 */
export const WEBGL_QUERY =
  "(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

/**
 * Renders `children` only on a machine that should run WebGL.
 *
 * Gating with state rather than CSS is the point: a `lg:block` wrapper would
 * still import the module and still start the render loop on every device,
 * merely hiding the result. Here the dynamic import does not even begin until
 * the query matches, which is what makes the cost conditional instead of the
 * visibility.
 *
 * It returns `null` on the server and on the first client render, so there is
 * nothing to mismatch during hydration. Everything these layers sit on top of is
 * authored to look finished without them.
 */
export function DesktopOnlyWebGl({ children }: { children: React.ReactNode }) {
  const [habilitado, setHabilitado] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(WEBGL_QUERY);
    const sync = () => setHabilitado(mq.matches);
    sync();
    // Re-evaluated on a resize past the breakpoint and on the visitor changing
    // their motion preference mid-session, which is a real thing on macOS.
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  if (!habilitado) return null;
  return <>{children}</>;
}
