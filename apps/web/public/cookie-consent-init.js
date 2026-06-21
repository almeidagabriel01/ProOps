/*
 * Cookie-consent first-paint gate.
 *
 * The consent banner can only be decided client-side (it depends on
 * localStorage), so if it waited for React to hydrate it would paint ~6s late
 * on throttled mobile — and being a wide text block it became the LCP element,
 * wrecking the metric on every public page. This script runs at parse time
 * (beforeInteractive), reads the consent flag, and flips an attribute on <html>
 * so the server-rendered banner becomes visible at FIRST paint (or stays hidden
 * for users who already consented) with zero hydration wait and no layout shift
 * (the banner is position:fixed). React later hydrates the same DOM and owns the
 * dismiss interaction.
 *
 * Served as a same-origin static file (loaded via <script src>) so it satisfies
 * CSP `script-src 'self'` without 'unsafe-inline'. Key/value mirror
 * src/lib/cookie-consent-storage.ts.
 */
(function () {
  try {
    if (localStorage.getItem("proops_cookie_consent") !== "dismissed") {
      document.documentElement.setAttribute("data-cookie-consent", "pending");
    }
  } catch (_) {
    /* no-op: localStorage blocked → banner stays hidden, no worse than before */
  }
})();
