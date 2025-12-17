/**
 * Team types and constants
 */

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  permissions: Record<string, Permission>;
}

export interface Permission {
  canView: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const AVAILABLE_PAGES = [
  { id: "dashboard", name: "Dashboard", description: "Visão geral e métricas" },
  { id: "proposals", name: "Propostas", description: "Criar e gerenciar propostas" },
  { id: "clients", name: "Clientes", description: "Base de clientes" },
  { id: "products", name: "Produtos", description: "Catálogo de produtos" },
  { id: "financial", name: "Financeiro", description: "Fluxo de caixa e transações" },
];

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
