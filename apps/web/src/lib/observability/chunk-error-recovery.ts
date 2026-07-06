import {
  CHUNK_RELOAD_STORAGE_KEY,
  shouldReloadOnChunkError,
} from "./decide-chunk-error-recovery";

let installed = false;

interface ChunkErrorRecoveryDeps {
  reload?: () => void;
  storage?: Pick<Storage, "getItem" | "setItem">;
  now?: () => number;
}

/**
 * Auto-recovers from stale-deploy chunk failures (white page on SPA
 * navigation after a new deploy) by reloading the page once. The
 * sessionStorage timestamp caps recovery at one reload per cooldown
 * window, so a genuinely broken deploy never causes a reload loop.
 * Listeners must be registered AFTER the client error reporter's so the
 * failure is still reported (flushed via beacon on pagehide) before the
 * reload navigates away.
 */
export function installChunkErrorRecovery(deps?: ChunkErrorRecoveryDeps): () => void {
  if (installed || typeof window === "undefined") return () => undefined;
  installed = true;

  const reload = deps?.reload ?? (() => window.location.reload());
  const storage = deps?.storage ?? window.sessionStorage;
  const now = deps?.now ?? Date.now;

  const recover = (error: unknown) => {
    try {
      const decision = shouldReloadOnChunkError({
        error,
        lastReloadAt: storage.getItem(CHUNK_RELOAD_STORAGE_KEY),
        now: now(),
      });
      if (!decision) return;
      storage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(now()));
      reload();
    } catch {
      // storage unavailable (private mode/quota) — never reload without the loop guard
    }
  };

  const onError = (event: ErrorEvent) => recover(event.error ?? event.message);
  const onRejection = (event: PromiseRejectionEvent) => recover(event.reason);

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    installed = false;
  };
}
