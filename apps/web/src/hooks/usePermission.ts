"use client";

import { permissionDocOf, usePermissions } from "@/providers/permissions-context";
import {
  getPermissionPageDef,
  resolvePermissionKey,
  resolvePermissionScope,
} from "@/lib/permissions/catalog";

/**
 * A conta de demonstração vê tudo e abre os formulários, mas não cria nem
 * exclui (a escrita é barrada no api-client e no backend): o mesmo desenho de
 * `usePagePermission`. As chaves finas seguem esse doc.
 */
const DEMO_DOC = { canView: true, canCreate: false, canEdit: true, canDelete: false };

/**
 * Uma chave do catálogo de permissões (`lib/permissions/catalog.ts`): ação
 * básica, ação fina (`approve`, `settle`...) ou dado sensível (`viewCost`).
 * Chave ausente vale o fallback do catálogo, o mesmo que o backend aplica.
 * Enquanto as permissões carregam, devolve `false`: esconder é o lado seguro.
 */
export function usePermission(pageId: string, key: string): boolean {
  const { permissions, isMaster, isDemo, isLoading } = usePermissions();
  if (isLoading || permissions === null) return false;
  if (isMaster) return true;
  if (isDemo) return resolvePermissionKey(pageId, DEMO_DOC, key);
  const page = permissions.pages[pageId];
  return resolvePermissionKey(pageId, permissionDocOf(page), key);
}

/**
 * O escopo do membro numa página com "só os meus". Dono, administradores e a
 * demonstração veem tudo (`"all"`). Enquanto carrega, devolve o mais restrito.
 */
export function usePageScope(pageId: string): { scope: string; isLoading: boolean } {
  const { permissions, isMaster, isDemo, isLoading } = usePermissions();
  const def = getPermissionPageDef(pageId)?.scope;
  if (isLoading || permissions === null) return { scope: def?.narrowest ?? "all", isLoading: true };
  if (isMaster || isDemo) return { scope: "all", isLoading: false };
  const page = permissions.pages[pageId];
  return { scope: resolvePermissionScope(pageId, permissionDocOf(page)) ?? "all", isLoading: false };
}

/**
 * Os dados sensíveis do catálogo, de uma vez, para as telas que mostram valor.
 * Enquanto as permissões carregam, tudo vem `false` (esconde em vez de piscar).
 */
export function useSensitiveData() {
  const { isLoading } = usePermissions();
  return {
    isLoading,
    canSeeCost: usePermission("products", "viewCost"),
    canSeeStock: usePermission("products", "viewStock"),
    canSeeContractValues: usePermission("contracts", "viewValues"),
    canSeeServiceOrderPrices: usePermission("service_orders", "viewPrices"),
    canSeeCommissions: usePermission("transactions", "viewCommissions"),
    canSeeBalance: usePermission("wallet", "viewBalance"),
  };
}
