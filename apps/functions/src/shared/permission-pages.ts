/**
 * As páginas que a tela de Equipe concede por membro, e as quatro ações de
 * cada uma. A lista canônica, com nome e descrição, é `PERMISSION_PAGES` em
 * `apps/web/src/lib/permissions/pages.ts`; aqui só os ids, para o backend
 * recusar o que não existe. O teste de paridade do front falha se as duas
 * listas divergirem.
 *
 * Puro, sem import: o front o importa atravessando para apps/functions.
 */
export const ASSIGNABLE_PERMISSION_PAGE_IDS = [
  "dashboard",
  "kanban",
  "proposals",
  "clients",
  "products",
  "services",
  "spreadsheets",
  "calendar",
  "tasks",
  "projects",
  "service_orders",
  "service_orders_all",
  "equipment",
  "contracts",
  "solutions",
  "transactions",
  "wallet",
  "invoices",
] as const;

export const PERMISSION_ACTION_KEYS = ["canView", "canCreate", "canEdit", "canDelete"] as const;

export type AssignablePermissionPageId = (typeof ASSIGNABLE_PERMISSION_PAGE_IDS)[number];

export function isAssignablePermissionPage(value: unknown): value is AssignablePermissionPageId {
  return typeof value === "string" && (ASSIGNABLE_PERMISSION_PAGE_IDS as readonly string[]).includes(value);
}

export function isPermissionActionKey(value: unknown): value is (typeof PERMISSION_ACTION_KEYS)[number] {
  return typeof value === "string" && (PERMISSION_ACTION_KEYS as readonly string[]).includes(value);
}
