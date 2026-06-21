/**
 * Regression: `googleapis` is a heavy module (~0.9s to require — it cold-loads
 * its full API surface). When it was imported eagerly at the top of
 * calendar.controller.ts it landed in the Cloud Functions discovery graph and
 * pushed local emulator cold starts past the 10s discovery timeout
 * ("Cannot determine backend specification. Timeout after 10000.").
 *
 * It must stay lazily loaded — only required when a Google Calendar request
 * actually runs — so merely loading the controller module must NOT pull
 * googleapis into the require cache. This test fails if anyone reintroduces a
 * top-level `import ... from "googleapis"` in the controller (or one of its
 * eagerly imported dependencies).
 */

jest.mock("../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("../../lib/token-encryption", () => ({
  encryptToken: jest.fn(),
  decryptToken: jest.fn(),
}));
jest.mock("../../init", () => ({ db: { collection: jest.fn() } }));

const isGoogleapisCached = (): boolean =>
  Object.keys(require.cache).some((key) =>
    /[\\/]node_modules[\\/]googleapis[\\/]/.test(key),
  );

describe("calendar.controller lazy googleapis loading", () => {
  it("does not eagerly require googleapis when the controller module loads", () => {
    // Clean baseline for this isolated module registry.
    expect(isGoogleapisCached()).toBe(false);

    require("./calendar.controller");

    // With the eager `import { google } from "googleapis"` this would now be
    // true; the lazy loader keeps it out of the eager require graph.
    expect(isGoogleapisCached()).toBe(false);
  });
});
