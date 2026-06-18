/*
 * Browser back/forward recovery.
 *
 * A back/forward navigation restores a cached render WITHOUT re-executing JS
 * (React never re-mounts), so Framer Motion entrance animations never re-fire
 * and content stays at its server-rendered `initial` hidden state (opacity:0)
 * — a blank white page that only a manual reload fixes. Since JS can't run to
 * "replay" the animation on the restore, a reload is the only recovery.
 *
 * This listener is attached at parse time and never removed, so it survives the
 * restore (a React-effect listener does not — the tree isn't re-mounted). It
 * reloads when the page was restored from bfcache (`event.persisted`) or the
 * navigation is a history traversal (`PerformanceNavigationTiming.type ===
 * "back_forward"`). After the reload the navigation type is "reload", so it
 * never loops.
 *
 * Served as a same-origin static file (loaded via <script src>) so it satisfies
 * CSP `script-src 'self'` without relying on `'unsafe-inline'`. End-to-end
 * regression coverage: tests/e2e/navigation/back-forward-recovery.spec.ts.
 */
(function () {
  window.addEventListener("pageshow", function (e) {
    try {
      var nav = performance.getEntriesByType("navigation")[0];
      if (e.persisted || (nav && nav.type === "back_forward")) {
        window.location.reload();
      }
    } catch (_) {
      /* no-op */
    }
  });
})();
