import { onIdTokenChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

let cachedToken: string | null = null;
let installed = false;

export function getCachedIdToken(): string | null {
  return cachedToken;
}

/**
 * Subscribe to Firebase ID-token changes (login, ~hourly auto-refresh, logout)
 * and keep the freshest token cached for synchronous read by the error reporter.
 * Returns a teardown that unsubscribes and clears the cache. SSR-safe.
 */
export function installIdentityTokenCache(): () => void {
  if (installed || typeof window === "undefined") return () => undefined;
  installed = true;

  const unsubscribe = onIdTokenChanged(auth, (user) => {
    if (!user) {
      cachedToken = null;
      return;
    }
    user
      .getIdToken()
      .then((token) => {
        cachedToken = token;
      })
      .catch(() => {
        // keep the prior token; never throw from the cache
      });
  });

  return () => {
    unsubscribe();
    cachedToken = null;
    installed = false;
  };
}

// test-only: inject a cache value without Firebase auth (justified for unit tests)
export function __setCachedIdTokenForTest(token: string | null): void {
  cachedToken = token;
}

// test-only: reset the installed flag (justified for unit tests that call installIdentityTokenCache multiple times)
export function __resetInstalledForTest(): void {
  installed = false;
}
