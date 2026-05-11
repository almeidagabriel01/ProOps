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

  // 4. Free → landing (free não tem acesso ao ERP)
  if (user.role === "free") {
    return { kind: "landing", path: "/" };
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
