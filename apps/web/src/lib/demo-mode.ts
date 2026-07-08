/**
 * Client-side demo-mode flag for the free-tier read-only experience (Feature B).
 *
 * The tenant-provider sets this whenever the account is a free/demo account so
 * the shared api-client (a plain module that can't consume React context) can
 * short-circuit mutations with a friendly message — defense-in-depth over the
 * backend gate, which already returns 402 for the same requests.
 */

let demoMode = false;

export function setDemoMode(value: boolean): void {
  demoMode = value;
}

export function isDemoMode(): boolean {
  return demoMode;
}

// Mutations a demo account IS still allowed to make: everything needed to
// subscribe / manage its own account. Mirrors the backend
// FREE_TIER_ALLOWED_PREFIXES so the two gates never disagree.
const DEMO_ALLOWED_MUTATION_PREFIXES = [
  "/v1/stripe",
  "/v1/billing",
  "/v1/profile",
  "/v1/auth",
  "/v1/users/me",
  "/v1/tenants",
  "/v1/validation",
];

/**
 * True when a demo account is attempting a data mutation that must be blocked.
 * GETs and account/billing mutations are always allowed.
 */
export function isDemoBlockedMutation(method: string, path: string): boolean {
  if (!demoMode) return false;
  if (method.toUpperCase() === "GET") return false;
  return !DEMO_ALLOWED_MUTATION_PREFIXES.some((prefix) => path.startsWith(prefix));
}
