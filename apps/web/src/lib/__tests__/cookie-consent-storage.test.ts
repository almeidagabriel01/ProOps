import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  COOKIE_CONSENT_KEY,
  getCookieConsentDismissed,
  setCookieConsentDismissed,
} from "../cookie-consent-storage";

function installFakeLocalStorage() {
  const store = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
  };
  return store;
}

function removeWindow() {
  delete (globalThis as { window?: unknown }).window;
}

describe("cookie-consent-storage", () => {
  afterEach(() => {
    removeWindow();
  });

  describe("with localStorage available", () => {
    beforeEach(() => {
      installFakeLocalStorage();
    });

    it("returns false before any consent is recorded", () => {
      expect(getCookieConsentDismissed()).toBe(false);
    });

    it("returns true after the banner is dismissed", () => {
      setCookieConsentDismissed();
      expect(getCookieConsentDismissed()).toBe(true);
    });

    it("persists the dismissal under the expected key", () => {
      const store = installFakeLocalStorage();
      setCookieConsentDismissed();
      expect(store.get(COOKIE_CONSENT_KEY)).toBe("dismissed");
    });
  });

  describe("in a server environment (no window)", () => {
    beforeEach(() => {
      removeWindow();
    });

    it("returns false without throwing", () => {
      expect(() => getCookieConsentDismissed()).not.toThrow();
      expect(getCookieConsentDismissed()).toBe(false);
    });

    it("does not throw when attempting to persist", () => {
      expect(() => setCookieConsentDismissed()).not.toThrow();
    });
  });
});
