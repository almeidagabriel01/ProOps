/**
 * Races a promise against a deadline. Resolves with the promise's value if it
 * settles in time; otherwise rejects with a `TimeoutError`. The pending promise
 * is NOT cancelled (JS promises aren't cancellable) — callers must treat a
 * timeout as a failed attempt and avoid trusting the late result.
 *
 * Exists because the auth-init critical path awaits network calls (Firestore
 * reads, the /api/auth/session POST, token refresh) that, left unbounded, can
 * hang forever and trap the UI on a full-screen loader. Every such await is
 * wrapped here so a stall becomes a deterministic rejection instead.
 */
export class TimeoutError extends Error {
  constructor(message = "Operation timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(`Operation timed out after ${ms}ms`));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
