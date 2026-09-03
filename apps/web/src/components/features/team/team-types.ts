/**
 * Team types and constants
 */

import { PERMISSION_PAGES } from "@/lib/permissions/pages";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  phoneNumber?: string;
  permissions: Record<string, Permission>;
}

export interface Permission {
  canView: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

/**
 * Lista exibida na tela de Equipe. Vive em `lib/permissions/pages.ts` para ser
 * a MESMA consumida por `getDefaultPermissions()` no wizard de criação — antes
 * eram duas listas e cada módulo novo entrava só numa delas.
 */
export { PERMISSION_PAGES as AVAILABLE_PAGES } from "@/lib/permissions/pages";
export type { PermissionPage } from "@/lib/permissions/pages";

/** Mantido para call sites que só precisam dos ids. */
export const AVAILABLE_PAGE_IDS = PERMISSION_PAGES.map((page) => page.id);

export const ROLE_PRESETS = [
  {
    id: "viewer",
    name: "Visualizador",
    icon: "👁️",
    description: "Pode apenas visualizar dados",
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  },
  {
    id: "editor",
    name: "Editor",
    icon: "✏️",
    description: "Pode visualizar e editar dados",
    color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  },
  {
    id: "admin",
    name: "Administrador",
    icon: "🛡️",
    description: "Acesso completo (exceto plano)",
    color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  },
];
