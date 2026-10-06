"use client";

/**
 * O contexto das permissões, sem Firebase: os tipos, o contexto e o hook
 * `usePermissions`. Mora à parte do `PermissionsProvider` (que busca as
 * permissões no Firestore) para quem só LÊ, como `usePermission` e os
 * componentes de tela, não arrastar a inicialização do Firebase, inclusive
 * nos testes.
 */

import * as React from "react";

// ============================================
// TYPES
// ============================================

export interface PagePermission {
  pageId: string;
  pageSlug: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  /**
   * O doc como foi gravado, com as ações finas, os dados sensíveis e o escopo
   * do catálogo (`lib/permissions/catalog.ts`). Quem lê uma chave fina passa
   * por `resolvePermissionKey`, que aplica o fallback de chave ausente.
   */
  raw?: Record<string, unknown>;
}

/** O doc gravado de uma página, para as leituras do catálogo. */
export function permissionDocOf(page: PagePermission | undefined | null): Record<string, unknown> | null {
  if (!page) return null;
  return page.raw ?? (page as unknown as Record<string, unknown>);
}

export interface UserPermissions {
  role: "MASTER" | "MEMBER";
  masterId: string | null;
  companyId: string;
  companyName: string;
  masterName?: string; // Only for MEMBERs
  pages: Record<string, PagePermission>;
}

interface PermissionsContextType {
  permissions: UserPermissions | null;
  isLoading: boolean;
  hasPermission: (
    pageId: string,
    action: "view" | "create" | "edit" | "delete",
  ) => boolean;
  isMaster: boolean;
  isMember: boolean;
  /** Free/demo account: gets full UI permissions (writes blocked downstream). */
  isDemo: boolean;
  refreshPermissions: () => Promise<void>;
}

export const PermissionsContext = React.createContext<PermissionsContextType>({
  permissions: null,
  isLoading: true,
  hasPermission: () => false,
  isMaster: false,
  isMember: false,
  isDemo: false,
  refreshPermissions: async () => {},
});


/**
 * Main hook to access permissions context
 */
export function usePermissions() {
  return React.useContext(PermissionsContext);
}
