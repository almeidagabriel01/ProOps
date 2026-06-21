// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { onIdTokenChanged } = vi.hoisted(() => ({ onIdTokenChanged: vi.fn() }));
vi.mock("@/lib/firebase", () => ({ auth: {} }));
vi.mock("firebase/auth", () => ({ onIdTokenChanged }));

import {
  getCachedIdToken,
  installIdentityTokenCache,
  __setCachedIdTokenForTest,
  __resetInstalledForTest,
} from "../identity-token-cache";

beforeEach(() => {
  onIdTokenChanged.mockReset();
  __setCachedIdTokenForTest(null);
  __resetInstalledForTest();
});
afterEach(() => {
  __setCachedIdTokenForTest(null);
  __resetInstalledForTest();
});

describe("identity-token-cache", () => {
  it("caches the token when a user is present", async () => {
    let cb: (u: unknown) => void = () => {};
    onIdTokenChanged.mockImplementation((_auth, fn) => {
      cb = fn;
      return () => {};
    });
    installIdentityTokenCache();
    await cb({ getIdToken: () => Promise.resolve("tok-123") });
    // allow the resolved getIdToken().then to run
    await Promise.resolve();
    expect(getCachedIdToken()).toBe("tok-123");
  });

  it("clears the cache when the user signs out (null)", async () => {
    __setCachedIdTokenForTest("stale");
    let cb: (u: unknown) => void = () => {};
    onIdTokenChanged.mockImplementation((_auth, fn) => {
      cb = fn;
      return () => {};
    });
    installIdentityTokenCache();
    await cb(null);
    expect(getCachedIdToken()).toBeNull();
  });

  it("unsubscribe clears the cache and detaches", async () => {
    const unsub = vi.fn();
    onIdTokenChanged.mockReturnValue(unsub);
    __setCachedIdTokenForTest("tok");
    const teardown = installIdentityTokenCache();
    teardown();
    expect(unsub).toHaveBeenCalled();
    expect(getCachedIdToken()).toBeNull();
  });
});
