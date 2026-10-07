/**
 * Team types and constants
 */

import { PERMISSION_PAGES, type PagePermissionFlags } from "@/lib/permissions/pages";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  phoneNumber?: string;
  permissions: Record<string, Permission>;
  /** "suspended" quando o dono suspendeu o acesso (a conta fica desativada). */
  status?: "active" | "suspended";
}

/** O doc de uma página, com as chaves finas e o escopo do catálogo. */
export type Permission = PagePermissionFlags;

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
    description: "Consulta as telas, sem mexer em nada e sem ver o financeiro",
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  },
  {
    id: "seller",
    name: "Vendedor",
    icon: "💼",
    description: "CRM, propostas e contatos dele, catálogo sem custo nem estoque, sem financeiro",
    color: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  },
  {
    id: "editor",
    name: "Editor",
    icon: "✏️",
    description: "Vê, cria e edita em todas as telas, sem excluir",
    color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  },
  {
    id: "finance",
    name: "Financeiro",
    icon: "💰",
    description: "Lançamentos, carteiras e notas, com consulta a contatos, propostas e contratos",
    color: "bg-lime-500/10 text-lime-600 border-lime-500/20",
  },
  {
    id: "technician",
    name: "Técnico",
    icon: "🔧",
    description: "Atende as ordens de serviço e as obras atribuídas a ele, sem ver valores",
    color: "bg-teal-500/10 text-teal-500 border-teal-500/20",
  },
  {
    id: "admin",
    name: "Acesso completo às telas",
    icon: "🛡️",
    description: "Tudo nas telas. Equipe, plano, pagamentos e configuração fiscal continuam só do dono",
    color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  },
];
