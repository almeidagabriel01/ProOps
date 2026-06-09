/**
 * Effective max-requests ceiling for a rate limiter.
 *
 * Inside any Firebase emulator we raise the limit to a harmless ceiling so local
 * development and the E2E suite don't trip fixed-window counters that never
 * reset between requests/specs. Detection must cover BOTH signals:
 *
 *  - `FIRESTORE_EMULATOR_HOST` — injected only when the Firestore emulator runs.
 *  - `FUNCTIONS_EMULATOR` — set by the Functions emulator even when it talks to a
 *    real Firestore (e.g. `npm run dev:backend` pointed at the cloud project).
 *
 * Relying on `FIRESTORE_EMULATOR_HOST` alone leaves the functions-emulator-only
 * setup subject to production limits. Neither var is ever set in Cloud Run, so
 * deployed limits are untouched.
 */
export const EMULATOR_RATE_LIMIT_MAX = 1_000_000;

export function isEmulatedRuntime(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  // Cover every reliable emulator signal. `firebase emulators:start` always
  // sets FIREBASE_EMULATOR_HUB; the Functions emulator sets FUNCTIONS_EMULATOR;
  // the Firestore emulator sets FIRESTORE_EMULATOR_HOST. Accept any truthy
  // FUNCTIONS_EMULATOR except the literal "false". None are set in Cloud Run.
  return (
    Boolean(env.FIRESTORE_EMULATOR_HOST) ||
    Boolean(env.FIREBASE_EMULATOR_HUB) ||
    (Boolean(env.FUNCTIONS_EMULATOR) && env.FUNCTIONS_EMULATOR !== "false")
  );
}

/** Raw emulator signals — for startup diagnostics only (never logs secrets). */
export function emulatorRuntimeSignals(
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string | boolean> {
  return {
    emulated: isEmulatedRuntime(env),
    FUNCTIONS_EMULATOR: env.FUNCTIONS_EMULATOR ?? "(unset)",
    FIREBASE_EMULATOR_HUB: env.FIREBASE_EMULATOR_HUB ? "(set)" : "(unset)",
    FIRESTORE_EMULATOR_HOST: env.FIRESTORE_EMULATOR_HOST ? "(set)" : "(unset)",
  };
}

export function resolveEffectiveRateLimitMax(
  configuredMax: number,
  env: NodeJS.ProcessEnv = process.env,
): number {
  return isEmulatedRuntime(env) ? EMULATOR_RATE_LIMIT_MAX : configuredMax;
}
