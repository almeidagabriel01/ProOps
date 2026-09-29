/**
 * Fonte única das páginas que o sistema de permissões conhece.
 *
 * Antes disto existiam DUAS listas — `AVAILABLE_PAGES` (tela de edição do
 * membro) e as chaves de `getDefaultPermissions()` (passo 3 do wizard de
 * criação) — e elas divergiam. Todo módulo novo nascia numa e não na outra:
 * foi assim que o Calendário ficou impossível de conceder na criação (só na
 * edição) e as Notas Fiscais em lugar nenhum.
 *
 * O `id` é o documento em `users/{uid}/permissions/{id}` e é a MESMA chave
 * lida pelas quatro camadas:
 *
 *   1. rota      → `PAGE_CONFIG` em `lib/page-config.ts`
 *   2. navegação → `menuItems` em `layout/navigation-config.tsx`, ou o botão
 *                  que leva à tela quando ela não está na dock
 *   3. UI        → `usePagePermission(pageId)` na página
 *   4. backend   → `checkPermission(uid, pageId, acao)` no controller
 *
 * Ao adicionar um módulo, acrescente aqui primeiro e depois ligue as quatro.
 */

import type { TenantNiche } from "@/types";
import { getSolutionsPageConfig } from "@/lib/niches/config";

export type PermissionAction = "canView" | "canCreate" | "canEdit" | "canDelete";

export interface PermissionPage {
  /** ID do doc em users/{uid}/permissions/{id}. */
  id: string;
  name: string;
  description: string;
  /** Página sem criar/editar/excluir — só o toggle "Ver" é oferecido. */
  viewOnly?: boolean;
  /** Só é oferecida a tenants com o módulo financeiro contratado. */
  requiresFinancial?: boolean;
  /**
   * Não é uma tela: amplia o que o membro vê DENTRO da página indicada (o
   * backend filtra a lista por ela). Por isso não tem guarda de rota própria.
   */
  scopeOf?: string;
}

export const PERMISSION_PAGES: PermissionPage[] = [
  {
    id: "dashboard",
    name: "Dashboard",
    description: "Visão geral e métricas",
    viewOnly: true,
  },
  {
    id: "kanban",
    name: "CRM",
    description: "Quadro de propostas e lançamentos",
  },
  {
    id: "proposals",
    name: "Propostas",
    description: "Criar e gerenciar propostas",
  },
  { id: "clients", name: "Clientes", description: "Base de clientes" },
  { id: "products", name: "Produtos", description: "Catálogo de produtos" },
  { id: "services", name: "Serviços", description: "Catálogo de serviços" },
  {
    id: "spreadsheets",
    name: "Planilhas",
    description: "Planilhas integradas",
  },
  {
    id: "calendar",
    name: "Calendário",
    description: "Agenda, compromissos e acompanhamento",
  },
  {
    id: "tasks",
    name: "Tarefas",
    description: "O que fazer, com responsável, prazo e @menção",
  },
  {
    id: "projects",
    name: "Projetos",
    description: "Obras de instalação: etapas, fotos e entrega",
  },
  {
    id: "service_orders",
    name: "Ordens de serviço",
    description: "Chamados técnicos: agenda, execução e assinatura do cliente",
  },
  {
    // Sem esta, o membro vê e atende só as OS em que ele é o técnico. É o que
    // separa o técnico de campo de quem coordena a equipe.
    id: "service_orders_all",
    name: "Todas as ordens de serviço",
    description: "Ver as OS da equipe inteira, e não só as atribuídas a ele",
    viewOnly: true,
    scopeOf: "service_orders",
  },
  {
    id: "equipment",
    name: "Equipamentos",
    description: "Aparelhos instalados nos clientes, com garantia e histórico",
  },
  {
    id: "contracts",
    name: "Contratos",
    description: "Mensalidades de manutenção e monitoramento, com visitas preventivas",
  },
  {
    id: "solutions",
    name: "Soluções",
    description: "Aplicativos, automações e ambientes",
  },
  {
    id: "transactions",
    name: "Lançamentos (Financeiro)",
    description: "Registros e movimentações financeiras",
    requiresFinancial: true,
  },
  {
    id: "wallet",
    name: "Carteira (Financeiro)",
    description: "Gestão de saldos e contas",
    requiresFinancial: true,
  },
  {
    id: "invoices",
    name: "Notas Fiscais (Financeiro)",
    description: "Emissão e acompanhamento de notas",
    requiresFinancial: true,
  },
];

const PAGE_BY_ID = new Map(PERMISSION_PAGES.map((page) => [page.id, page]));

export function getPermissionPage(pageId: string): PermissionPage | undefined {
  return PAGE_BY_ID.get(pageId);
}

/**
 * O nome que as telas de Equipe mostram. O pageId "solutions" gateia Soluções
 * e Ambientes, e o nome acompanha o do menu no nicho da empresa ("Sistemas" em
 * segurança, "Ambientes" em persianas). Só o rótulo muda: o `id` gravado em
 * `users/{uid}/permissions` é o mesmo em todo nicho.
 */
export function getPermissionPageName(
  page: PermissionPage,
  niche?: TenantNiche | null,
): string {
  if (page.id === "solutions") return getSolutionsPageConfig(niche).navigationLabel;
  return page.name;
}

/**
 * Páginas oferecidas ao master, já filtradas pelo plano do tenant.
 * Usada pelas duas telas (criação e edição) para que não voltem a divergir.
 */
export function getAssignablePages(hasFinancial: boolean): PermissionPage[] {
  return PERMISSION_PAGES.filter(
    (page) => !page.requiresFinancial || hasFinancial,
  );
}

export interface PagePermissionFlags {
  canView: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export type MemberPermissions = Record<string, PagePermissionFlags>;

export type RolePreset = "viewer" | "editor" | "admin" | "technician";

/**
 * O técnico de campo: atende as OS atribuídas a ele (sem criar nem excluir),
 * consulta os equipamentos e vê a agenda. O resto do ERP fica fechado, e
 * `service_orders_all` fica de fora de propósito.
 */
const TECHNICIAN_PERMISSIONS: MemberPermissions = {
  service_orders: { canView: true, canCreate: false, canEdit: true, canDelete: false },
  equipment: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  calendar: { canView: true, canCreate: false, canEdit: false, canDelete: false },
};

/**
 * Permissões iniciais de um MEMBER novo, derivadas de `PERMISSION_PAGES`.
 *
 * Vive aqui, e não no hook `useCreateMember`, porque é função pura: mantê-la
 * junto do hook obrigava qualquer consumidor (e qualquer teste) a arrastar o
 * cliente HTTP e a inicialização do Firebase.
 */
export function getDefaultPermissions(
  roleType: RolePreset = "viewer",
  hasFinancial: boolean = true,
): MemberPermissions {
  const permissions: MemberPermissions = {};

  for (const page of getAssignablePages(hasFinancial)) {
    if (roleType === "technician") {
      permissions[page.id] = TECHNICIAN_PERMISSIONS[page.id] ?? {
        canView: false,
        ...(page.viewOnly ? {} : { canCreate: false, canEdit: false, canDelete: false }),
      };
      continue;
    }

    // Dashboard e afins não têm criar/editar/excluir — só o toggle "Ver".
    if (page.viewOnly) {
      permissions[page.id] = { canView: true };
      continue;
    }

    permissions[page.id] = {
      canView: true,
      canCreate: roleType !== "viewer",
      canEdit: roleType !== "viewer",
      canDelete: roleType === "admin",
    };
  }

  return permissions;
}
