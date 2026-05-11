import "server-only";

import { getAdminFirestore } from "@/lib/firebase-admin";
import { isSubscriptionBlocked, HARD_BLOCKED_STATUSES } from "./subscription-blocked-statuses";

export { HARD_BLOCKED_STATUSES, isSubscriptionBlocked };
export { PAGE_ROUTE_MAP, ORDERED_MEMBER_PAGES, resolveUserHome } from "./resolve-user-home";
export type { ResolvedHome } from "./resolve-user-home";

export interface ServerUserData {
  uid: string;
  role: string;
  tenantId: string | null;
  subscriptionStatus: string;
  pastDueSince: string | null;
  permissions: Record<
    string,
    { canView?: boolean; canCreate?: boolean; canEdit?: boolean; canDelete?: boolean }
  >;
}

export async function loadServerUserData(uid: string): Promise<ServerUserData | null> {
  try {
    const db = getAdminFirestore();
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) return null;
    const data = userSnap.data() as Record<string, unknown> | undefined;
    if (!data) return null;

    const role = String(data.role || "").toLowerCase();
    const tenantId = typeof data.tenantId === "string" ? data.tenantId.trim() : null;

    // Get subscription status from tenant doc (source of truth — claims can be stale)
    let subscriptionStatus = "";
    let pastDueSince: string | null = null;
    if (tenantId) {
      const tenantSnap = await db.collection("tenants").doc(tenantId).get();
      if (tenantSnap.exists) {
        const tenantData = tenantSnap.data() as Record<string, unknown> | undefined;
        subscriptionStatus = String(tenantData?.subscriptionStatus || "").trim().toLowerCase();
        pastDueSince =
          typeof tenantData?.pastDueSince === "string" && tenantData.pastDueSince
            ? (tenantData.pastDueSince as string)
            : null;
      }
    }

    // Fetch permissions subcollection
    const permSnap = await db.collection("users").doc(uid).collection("permissions").get();
    const permissions: ServerUserData["permissions"] = {};
    permSnap.forEach((permDoc) => {
      const pData = permDoc.data();
      permissions[permDoc.id] = {
        canView: pData.canView ?? false,
        canCreate: pData.canCreate ?? false,
        canEdit: pData.canEdit ?? false,
        canDelete: pData.canDelete ?? false,
      };
    });
    // Profile fallback — always visible
    if (!permissions["profile"]) {
      permissions["profile"] = { canView: true, canCreate: false, canEdit: true, canDelete: false };
    }

    return { uid, role, tenantId, subscriptionStatus, pastDueSince, permissions };
  } catch {
    return null;
  }
}

export function resolveServerHome(userData: ServerUserData): string {
  const { role, subscriptionStatus, pastDueSince, permissions } = userData;

  if (role === "superadmin") return "/admin";

  if (isSubscriptionBlocked(subscriptionStatus, pastDueSince)) {
    return "/subscription-blocked";
  }

  if (role === "free") return "/";

  const isAdminLike = (["admin", "master"] as readonly string[]).includes(role);
  if (isAdminLike) return "/dashboard";

  if (permissions["dashboard"]?.canView === true) return "/dashboard";

  const ORDERED_MEMBER_PAGES = [
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

  const PAGE_ROUTE_MAP: Record<string, string> = {
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

  const firstAllowed = ORDERED_MEMBER_PAGES.find(
    (page) => permissions[page]?.canView === true || page === "profile",
  );
  if (firstAllowed) return PAGE_ROUTE_MAP[firstAllowed] ?? `/${firstAllowed}`;

  return "/";
}
