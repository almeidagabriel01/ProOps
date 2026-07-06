export const CHUNK_RELOAD_STORAGE_KEY = "proops:chunk-error-reload-at";
export const CHUNK_RELOAD_COOLDOWN_MS = 60_000;

const CHUNK_ERROR_PATTERNS = [
  /loading chunk [\w-]+ failed/i,
  /loading css chunk/i,
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
];

/**
 * Detects stale-deploy asset failures (webpack ChunkLoadError and the
 * browser-specific dynamic-import failure messages) without matching
 * generic network errors like "Failed to fetch".
 */
export function isChunkLoadError(err: unknown): boolean {
  if (err instanceof Error && err.name === "ChunkLoadError") return true;

  let message: string | null = null;
  if (typeof err === "string") {
    message = err;
  } else if (err instanceof Error) {
    message = err.message;
  } else if (
    typeof err === "object" &&
    err !== null &&
    typeof (err as { message?: unknown }).message === "string"
  ) {
    message = (err as { message: string }).message;
  }

  if (!message) return false;
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function shouldReloadOnChunkError(input: {
  error: unknown;
  lastReloadAt: string | null;
  now: number;
}): boolean {
  if (!isChunkLoadError(input.error)) return false;

  const lastReloadAt = Number(input.lastReloadAt);
  if (input.lastReloadAt === null || !Number.isFinite(lastReloadAt)) return true;

  return input.now - lastReloadAt > CHUNK_RELOAD_COOLDOWN_MS;
}
