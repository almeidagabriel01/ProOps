import { describe, it, expect } from "vitest";
import { config } from "../proxy";

// Next.js matches the full pathname against the matcher regex, so anchor it.
const pattern = Array.isArray(config.matcher)
  ? config.matcher[0]
  : (config.matcher as string);
const matcher = new RegExp(`^${pattern}$`);

describe("proxy matcher", () => {
  // Regression: the matcher excluded favicon.ico but not /icons/ nor the
  // app-router icon routes, so every icon PNG was intercepted by the auth
  // proxy and returned HTML instead of the image. That broke the favicon
  // (browser fell back to favicon.ico) and OG previews. These assets must
  // bypass the proxy so they are served as static files.
  it.each([
    "/favicon.ico",
    "/icons/icon-light-192.png",
    "/icons/icon-dark-192.png",
    "/apple-icon.png",
    "/opengraph-image.png",
    "/features/feature-1.webm",
  ])("does NOT intercept static asset %s", (path) => {
    expect(matcher.test(path)).toBe(false);
  });

  // Protected app routes must still pass through the proxy for auth checks.
  it.each(["/dashboard", "/proposals", "/crm", "/transactions"])(
    "still intercepts app route %s",
    (path) => {
      expect(matcher.test(path)).toBe(true);
    }
  );
});
