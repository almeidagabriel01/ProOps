/**
 * Decision for the browser back/forward recovery guard.
 *
 * Navigating with the browser's back/forward buttons restores a *cached* render
 * of the page. In that restored render the client never re-runs entrance work:
 * Framer Motion's `initial → animate` transitions don't fire, so every element
 * stays at its `initial` hidden state (opacity:0 / translated off-screen). The
 * DOM is present but visually blank — a white page that only a manual reload
 * fixes. (The stale auth context is a second hazard: a page restored after
 * logout could briefly show protected content.)
 *
 * A full `window.location.reload()` is the reliable recovery — it re-executes
 * everything fresh (navigation type becomes "reload", animations play) AND
 * re-runs the server-side proxy, so a logged-out restore lands on /login while a
 * public page simply re-renders. It mirrors exactly what the user does by hand.
 *
 * Two distinct restore signals, both handled:
 *  - `persisted` — the bfcache (back/forward cache) restore flag from the
 *    `pageshow` event. Set in production where bfcache is eligible.
 *  - `navigationType === "back_forward"` — `PerformanceNavigationTiming.type`.
 *    Set when the history navigation did a full document load instead of a
 *    bfcache restore (e.g. in dev, where the HMR socket disqualifies bfcache, or
 *    on any bfcache-ineligible page). `persisted` is false in this case, which
 *    is why a bfcache-only check missed it.
 *
 * After the reload the navigation type is "reload" and `persisted` is false, so
 * this never loops. A normal fresh load is type "navigate" → no reload.
 *
 * Kept pure (no DOM, no React) so it is unit-testable and the intent can't
 * silently regress. The actual runtime listener is a document-level inline
 * script in app/layout.tsx (it must be attached at parse time and never
 * removed, so it survives the restore — a React effect listener does not,
 * because the tree is not re-mounted on a back/forward restore). That script
 * mirrors this exact condition; keep the two in sync.
 */
export interface BfcacheRecoveryInput {
  /** The `pageshow` event's `persisted` flag — true only on a bfcache restore. */
  persisted: boolean;
  /** `PerformanceNavigationTiming.type` — "back_forward" on a history nav. */
  navigationType: string;
}

export function shouldReloadOnPageShow(input: BfcacheRecoveryInput): boolean {
  return input.persisted === true || input.navigationType === "back_forward";
}
