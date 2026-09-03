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
    name: "Calendario",
    description: "Agenda, compromissos e acompanhamento",
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

export type RolePreset = "viewer" | "editor" | "admin";

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
