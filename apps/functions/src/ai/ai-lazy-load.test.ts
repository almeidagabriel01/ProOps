/**
 * Cold-start regression guard: mounting the AI routes must NOT load the
 * AI SDKs (@google/genai, groq-sdk). They are dynamically imported inside
 * the request handlers (first AI request of the instance pays the cost).
 * Same pattern as calendar.controller.lazy-load.test.ts.
 */

jest.mock("../init", () => ({
  db: {},
  auth: {},
  adminApp: {},
}));

describe("AI SDK lazy loading", () => {
  it("mounting AI routes does not load @google/genai or groq-sdk", () => {
    jest.isolateModules(() => {
      require("./chat.route");
      require("./field-gen.route");
    });

    const loaded = Object.keys(require.cache).map((p) => p.replace(/\\/g, "/"));
    expect(loaded.some((p) => p.includes("@google/genai"))).toBe(false);
    expect(loaded.some((p) => p.includes("groq-sdk"))).toBe(false);
    expect(loaded.some((p) => p.includes("@google/generative-ai"))).toBe(false);
  });
});
