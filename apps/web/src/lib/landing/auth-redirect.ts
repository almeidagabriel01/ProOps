import type { User } from "@/types";

export function getAuthenticatedHome(user: User): string {
  if (user.role === "superadmin") {
    return "/admin";
  }

  const isAdmin = ["admin", "superadmin", "MASTER"].includes(user.role);
  const permissions = user.permissions || {};

  if (isAdmin || permissions.dashboard?.canView === true) {
    return "/dashboard";
  }

  const orderedPages = ["proposals", "clients", "products", "financial", "profile"];
  const firstAllowedPage = orderedPages.find(
    (page) => permissions[page]?.canView === true || page === "profile",
  );

  return firstAllowedPage ? `/${firstAllowedPage}` : "/403";
}
