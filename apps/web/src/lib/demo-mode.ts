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

// Demo-DATA mutation endpoints: creating/editing/deleting the ERP records the
// demo account is browsing. Only these are blocked (with a friendly toast) — a
// blocklist, not an allowlist, so background/account writes (onboarding,
// observability, notifications-read, profile, billing, …) pass through silently
// and never spam the user with "read-only" toasts. Writes are also refused by
// the backend and Firestore rules, so nothing is ever persisted regardless.
const DEMO_BLOCKED_MUTATION_PREFIXES = [
  "/v1/proposals",
  "/v1/products",
  "/v1/services",
  "/v1/clients",
  "/v1/aux", // sistemas/ambientes
  "/v1/sistemas",
  "/v1/ambientes",
  "/v1/spreadsheets",
  "/v1/transactions",
  "/v1/wallets",
  "/v1/kanban",
];

/**
 * True when a demo account is attempting to mutate the ERP demo data. GETs and
 * account/system mutations are allowed through (they fail harmlessly server-side
 * without a toast).
 */
export function isDemoBlockedMutation(method: string, path: string): boolean {
  if (!demoMode) return false;
  if (method.toUpperCase() === "GET") return false;
  return DEMO_BLOCKED_MUTATION_PREFIXES.some((prefix) => path.startsWith(prefix));
}
