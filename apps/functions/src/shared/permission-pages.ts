import { BASE_PERMISSION_ACTIONS, PERMISSION_CATALOG } from "./permission-catalog";

/**
 * Os ids das páginas que a tela de Equipe concede por membro, e as quatro
 * ações básicas. Derivados de `PERMISSION_CATALOG` (`permission-catalog.ts`),
 * que é a fonte única; o front espelha o catálogo com paridade testada.
 */
export const ASSIGNABLE_PERMISSION_PAGE_IDS: readonly string[] = PERMISSION_CATALOG.map((page) => page.id);

export const PERMISSION_ACTION_KEYS = BASE_PERMISSION_ACTIONS;

export function isAssignablePermissionPage(value: unknown): value is string {
  return typeof value === "string" && ASSIGNABLE_PERMISSION_PAGE_IDS.includes(value);
}

export function isPermissionActionKey(value: unknown): value is (typeof PERMISSION_ACTION_KEYS)[number] {
  return typeof value === "string" && (PERMISSION_ACTION_KEYS as readonly string[]).includes(value);
}
