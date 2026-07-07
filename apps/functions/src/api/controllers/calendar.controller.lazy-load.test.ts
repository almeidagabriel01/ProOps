/**
 * Regression: the Google API clients (@googleapis/calendar + @googleapis/oauth2,
 * which replaced the ~60MB `googleapis` metapackage) are heavy to require. When
 * the old metapackage was imported eagerly at the top of calendar.controller.ts
 * it landed in the Cloud Functions discovery graph and pushed local emulator
 * cold starts past the 10s discovery timeout ("Cannot determine backend
 * specification. Timeout after 10000.").
 *
 * They must stay lazily loaded — only required when a Google Calendar request
 * actually runs — so merely loading the controller module must NOT pull any
 * Google API client into the require cache. This test fails if anyone
 * reintroduces a top-level import of @googleapis/*, google-auth-library or
 * googleapis in the controller (or one of its eagerly imported dependencies).
 */

jest.mock("../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("../../lib/token-encryption", () => ({
  encryptToken: jest.fn(),
  decryptToken: jest.fn(),
}));
jest.mock("../../init", () => ({ db: { collection: jest.fn() } }));

// google-auth-library fica FORA do check: o firebase-admin (import legítimo
// e eager do controller) depende dele. O que não pode entrar no grafo eager
// são os clients de API (@googleapis/* e o metapackage googleapis).
const isGoogleApiCached = (): boolean =>
  Object.keys(require.cache).some((key) =>
    /[\\/]node_modules[\\/](googleapis|@googleapis)[\\/]/.test(key),
  );

describe("calendar.controller lazy Google API loading", () => {
  it("does not eagerly require any Google API client when the controller module loads", () => {
    // Clean baseline for this isolated module registry.
    expect(isGoogleApiCached()).toBe(false);

    require("./calendar.controller");

    // With an eager top-level import this would now be true; the lazy
    // loaders keep the clients out of the eager require graph.
    expect(isGoogleApiCached()).toBe(false);
  });
});
