/**
 * Decision for the `pageshow` (back/forward cache) recovery guard.
 *
 * When a page is restored from the browser's back/forward cache (bfcache), the
 * `pageshow` event fires with `persisted = true`. A bfcache restore re-displays
 * a frozen snapshot of the document: React's state is frozen too, so the SPA
 * never re-renders — in some browsers this surfaces as a blank/white page that
 * only a manual reload fixes. The auth context is also stale (e.g. the user
 * logged out in another tab), so a restored authenticated page could briefly
 * show protected content.
 *
 * A full `window.location.reload()` is the only reliable recovery: it repaints
 * the page AND re-runs the server-side proxy (auth + billing), so a logged-out
 * restore lands on /login while a public page simply re-renders. The decision
 * intentionally does NOT depend on auth state — a logged-in restore is exactly
 * the case that previously stayed blank.
 *
 * Kept as a pure function (no DOM, no React) so it is unit-testable and the
 * intent can't silently regress (e.g. someone re-adding an auth-state shortcut
 * that skips recovery and brings the white screen back).
 */
export interface BfcacheRecoveryInput {
  /** The `pageshow` event's `persisted` flag — true only on a bfcache restore. */
  persisted: boolean;
}

export function shouldReloadOnPageShow(input: BfcacheRecoveryInput): boolean {
  return input.persisted === true;
}
