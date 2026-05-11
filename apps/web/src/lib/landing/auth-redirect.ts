import type { User } from "@/types";
import { resolveUserHome } from "@/lib/auth/resolve-user-home";

export function getAuthenticatedHome(user: User): string {
  return resolveUserHome(user).path;
}
