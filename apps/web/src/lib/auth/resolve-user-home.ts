import type { User } from "@/types";
import { HARD_BLOCKED_STATUSES } from "./subscription-blocked-statuses";

// Mapeamento pageId → URL canônica (espelha useLoginForm.handleRedirectAfterAuth)
export const PAGE_ROUTE_MAP: Record<string, string> = {
  kanban: "/crm",
  proposals: "/proposals",
  clients: "/contacts",
  products: "/products",
  services: "/services",
  spreadsheets: "/spreadsheets",
  transactions: "/transactions",
  wallet: "/wallets",
  financial: "/transactions",
  profile: "/profile",
};

// Ordem de prioridade das páginas permitidas para MEMBER
export const ORDERED_MEMBER_PAGES = [
  "kanban",
  "proposals",
  "clients",
  "products",
  "services",
  "spreadsheets",
  "transactions",
  "wallet",
  "financial",
  "profile",
] as const;

export type ResolvedHome =
  | { kind: "landing"; path: "/" }
  | { kind: "admin"; path: "/admin" }
  | { kind: "dashboard"; path: "/dashboard" }
  | { kind: "first-allowed"; path: string }
  | { kind: "subscription-blocked"; path: "/subscription-blocked" };

export function resolveUserHome(user: User | null): ResolvedHome {
  // 1. Não autenticado → landing pública
  if (!user) {
    return { kind: "landing", path: "/" };
  }

  // 2. Superadmin → admin panel
  if (user.role === "superadmin") {
    return { kind: "admin", path: "/admin" };
  }

  // 3. Assinatura bloqueada (statuses duros; past_due não verificamos aqui — é server-side)
  const status = user.subscriptionStatus ?? "";
  if (HARD_BLOCKED_STATUSES.has(status)) {
    return { kind: "subscription-blocked", path: "/subscription-blocked" };
  }

  // 4. Free → dashboard (modo demo read-only, Feature B). Contas gratuitas
  //    entram no ERP e navegam pelos módulos do Starter vendo os dados
  //    fictícios do tenant demo; módulos premium aparecem com coroa.
  if (user.role === "free") {
    return { kind: "dashboard", path: "/dashboard" };
  }

  // 5. Admin/MASTER → dashboard
  const isAdminLike = (["admin", "MASTER"] as readonly string[]).includes(user.role);
  if (isAdminLike) {
    return { kind: "dashboard", path: "/dashboard" };
  }

  // 6. MEMBER com permissão de dashboard
  const permissions = user.permissions ?? {};
  if (permissions["dashboard"]?.canView === true) {
    return { kind: "dashboard", path: "/dashboard" };
  }

  // 7. MEMBER → primeira página permitida (profile é fallback garantido)
  const firstAllowed = ORDERED_MEMBER_PAGES.find(
    (page) => permissions[page]?.canView === true || page === "profile",
  );
  if (firstAllowed) {
    const path = PAGE_ROUTE_MAP[firstAllowed] ?? `/${firstAllowed}`;
    return { kind: "first-allowed", path };
  }

  // 8. Fallback absoluto → landing (nunca retornar /403 — é destino de erro, não de home)
  return { kind: "landing", path: "/" };
}

/**
 * Free tier (read-only demo mode) may visit:
 *   - "/"                       public landing
 *   - "/subscribe[/*]"          choose paid plan
 *   - "/checkout-success[/*]"   stripe callback
 *   - "/profile[/*]" "/settings[/*]"  manage own account (billing tab here)
 *   - "/subscription-blocked"   defensive
 *   - the Starter-tier ERP modules in DEMO_ACCESSIBLE_PREFIXES (read-only)
 *
 * Premium modules (Financeiro, CRM, editor de PDF) stay blocked — the dock
 * renders them crowned and opens the upgrade modal instead of navigating.
 * Exported separately from isPathAllowedForUser because the next.js
 * middleware and the billing-status route need to evaluate it from a
 * `plan` string without a full User object in hand.
 */
// ERP routes a free-tier / demo account may browse read-only (Feature B).
// These are the Starter-tier modules; premium modules (Financeiro, CRM, editor
// de PDF) stay off this list — the dock renders them crowned and intercepts the
// click with the upgrade modal instead of navigating.
const DEMO_ACCESSIBLE_PREFIXES = [
  "/dashboard",
  "/proposals",
  "/products",
  "/services",
  "/contacts",
  "/solutions",
  "/automation",
  "/ambientes",
  "/calendar",
  "/spreadsheets",
];

export function isFreeTierAllowedPath(path: string): boolean {
  const allowed = new Set([
    "/",
    "/subscribe",
    "/checkout-success",
    "/profile",
    "/settings",
    "/subscription-blocked",
  ]);
  const base = path.split("?")[0];
  return (
    allowed.has(base) ||
    base.startsWith("/subscribe/") ||
    base.startsWith("/profile/") ||
    base.startsWith("/settings/") ||
    base.startsWith("/checkout-success/") ||
    DEMO_ACCESSIBLE_PREFIXES.some(
      (prefix) => base === prefix || base.startsWith(`${prefix}/`),
    )
  );
}

export function isPathAllowedForUser(path: string, user: User | null): boolean {
  if (!user) return false;
  const role = (user.role ?? "").toLowerCase();

  if (role === "superadmin") {
    return path === "/admin" || path.startsWith("/admin/");
  }

  if (role === "free") {
    return isFreeTierAllowedPath(path);
  }

  // Paying users (admin, master, member, etc.): any internal route except /admin
  return !path.startsWith("/admin");
}
