import { describe, it, expect } from "vitest";

import {
  isChunkLoadError,
  shouldReloadOnChunkError,
  CHUNK_RELOAD_COOLDOWN_MS,
} from "../decide-chunk-error-recovery";

const NOW = 1_800_000_000_000;

describe("isChunkLoadError", () => {
  it("true for Error named ChunkLoadError (webpack)", () => {
    const err = new Error("Loading chunk 4823 failed.");
    err.name = "ChunkLoadError";
    expect(isChunkLoadError(err)).toBe(true);
  });

  it("true for message-only webpack chunk failure", () => {
    expect(
      isChunkLoadError(
        new Error(
          "Loading chunk 4823 failed. (error: https://app.proops.com.br/_next/static/chunks/4823-abc123.js)",
        ),
      ),
    ).toBe(true);
  });

  it("true for CSS chunk failure", () => {
    expect(isChunkLoadError(new Error("Loading CSS chunk 123 failed"))).toBe(true);
  });

  it("true for Chromium dynamic import failure", () => {
    expect(
      isChunkLoadError(
        new TypeError(
          "Failed to fetch dynamically imported module: https://app.proops.com.br/_next/static/chunks/app/page.js",
        ),
      ),
    ).toBe(true);
  });

  it("true for Firefox dynamic import failure", () => {
    expect(isChunkLoadError(new TypeError("error loading dynamically imported module"))).toBe(
      true,
    );
  });

  it("true for Safari module script failure", () => {
    expect(isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true);
  });

  it("true for plain string input", () => {
    expect(isChunkLoadError("Loading chunk 7 failed")).toBe(true);
  });

  it("true for non-Error object carrying a chunk message", () => {
    expect(isChunkLoadError({ message: "Loading chunk 7 failed" })).toBe(true);
  });

  it("false for generic network fetch error", () => {
    expect(isChunkLoadError(new TypeError("Failed to fetch"))).toBe(false);
  });

  it("false for unrelated Error", () => {
    expect(isChunkLoadError(new Error("boom"))).toBe(false);
  });

  it("false for null, undefined and empty object", () => {
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError({})).toBe(false);
  });
});

describe("shouldReloadOnChunkError", () => {
  const chunkError = new Error("Loading chunk 42 failed");

  it("true for chunk error with no previous reload", () => {
    expect(shouldReloadOnChunkError({ error: chunkError, lastReloadAt: null, now: NOW })).toBe(
      true,
    );
  });

  it("true for chunk error when last reload is older than the cooldown", () => {
    expect(
      shouldReloadOnChunkError({
        error: chunkError,
        lastReloadAt: String(NOW - CHUNK_RELOAD_COOLDOWN_MS - 1_000),
        now: NOW,
      }),
    ).toBe(true);
  });

  it("true when the stored value is garbage (treated as no previous reload)", () => {
    expect(
      shouldReloadOnChunkError({ error: chunkError, lastReloadAt: "not-a-number", now: NOW }),
    ).toBe(true);
  });

  it("false for chunk error within the cooldown (loop guard)", () => {
    expect(
      shouldReloadOnChunkError({
        error: chunkError,
        lastReloadAt: String(NOW - 1_000),
        now: NOW,
      }),
    ).toBe(false);
  });

  it("false for non-chunk error even with no previous reload", () => {
    expect(
      shouldReloadOnChunkError({ error: new Error("boom"), lastReloadAt: null, now: NOW }),
    ).toBe(false);
  });
});
