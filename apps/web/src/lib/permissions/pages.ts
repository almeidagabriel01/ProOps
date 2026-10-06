/**
 * Fonte única das páginas que o sistema de permissões conhece, derivada do
 * catálogo (`./catalog.ts`, espelho de `apps/functions/src/shared/permission-catalog.ts`).
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
 *   3. UI        → `usePagePermission(pageId)` / `usePermission(pageId, chave)`
 *   4. backend   → `hasPagePermission(claims, pageId, chave)` no controller
 *
 * Ao adicionar um módulo, acrescente no catálogo do backend, copie para o
 * espelho e depois ligue as quatro camadas.
 */

import type { TenantNiche } from "@/types";
import { getSolutionsPageConfig } from "@/lib/niches/config";
import {
  PERMISSION_CATALOG,
  getPermissionPageDef,
  type PermissionPageDef,
} from "./catalog";

export type PermissionAction = "canView" | "canCreate" | "canEdit" | "canDelete";

export type PermissionPage = PermissionPageDef;

export const PERMISSION_PAGES: readonly PermissionPage[] = PERMISSION_CATALOG;

export function getPermissionPage(pageId: string): PermissionPage | undefined {
  return getPermissionPageDef(pageId);
}

/**
 * O nome que as telas de Equipe mostram. O pageId "solutions" gateia Soluções
 * e Ambientes, e o nome acompanha o do menu no nicho da empresa ("Sistemas" em
 * segurança, "Ambientes" em persianas). Só o rótulo muda: o `id` gravado em
 * `users/{uid}/permissions` é o mesmo em todo nicho.
 */
export function getPermissionPageName(
  page: Pick<PermissionPage, "id" | "name">,
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
  return PERMISSION_PAGES.filter((page) => !page.requiresFinancial || hasFinancial);
}

/** O doc de uma página: as quatro ações, as chaves finas e o escopo. */
export interface PagePermissionFlags {
  canView: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  scope?: string;
  [key: string]: boolean | string | undefined;
}

export type MemberPermissions = Record<string, PagePermissionFlags>;

export type RolePreset = "viewer" | "editor" | "admin" | "technician" | "seller" | "finance";

type Grant = Omit<PagePermissionFlags, "canView"> & { canView?: boolean };
const VIEW: Grant = { canView: true };
const WORK: Grant = { canView: true, canCreate: true, canEdit: true };
const FULL: Grant = { canView: true, canCreate: true, canEdit: true, canDelete: true };

/**
 * O técnico de campo: atende as OS atribuídas a ele (sem criar nem excluir,
 * sem ver valores nem reabrir), acompanha as obras (marca etapas, fotos e os
 * itens instalados, sem criar nem excluir projeto), consulta os equipamentos e
 * vê a agenda. O resto do ERP fica fechado, e `service_orders_all` fica de
 * fora de propósito. Propostas também: a obra traz a lista do que instalar sem
 * valor nenhum.
 */
const TECHNICIAN: Record<string, Grant> = {
  service_orders: { canView: true, canEdit: true, viewPrices: false, reopen: false },
  projects: { canView: true, canEdit: true },
  equipment: VIEW,
  calendar: VIEW,
  lia: VIEW,
  products: { viewCost: false },
};

/**
 * Quem vende: CRM, propostas e contatos com escrita, cada um vendo SÓ os
 * dele; catálogo para consultar, sem custo, markup nem estoque; nada do
 * financeiro. Aprova e dá desconto, mas não troca o responsável pela venda
 * nem mexe em comissão.
 */
const SELLER: Record<string, Grant> = {
  dashboard: VIEW,
  tasks: WORK,
  calendar: WORK,
  lia: VIEW,
  kanban: { ...WORK, columns: false, reassignLead: false, scope: "own" },
  proposals: { ...WORK, changeSeller: false, commissions: false, scope: "own" },
  clients: { ...WORK, reassign: false, priceTable: false, scope: "own" },
  products: { canView: true, viewCost: false, viewStock: false },
  services: VIEW,
  solutions: VIEW,
};

/**
 * Quem cuida do financeiro: lançamentos completos, carteiras sem excluir,
 * notas sem cancelar, e o que precisa consultar para conferir.
 */
const FINANCE: Record<string, Grant> = {
  dashboard: VIEW,
  tasks: WORK,
  calendar: VIEW,
  lia: VIEW,
  transactions: { ...FULL, viewCommissions: true },
  wallet: WORK,
  invoices: { ...WORK, cancel: false },
  clients: VIEW,
  proposals: VIEW,
  contracts: VIEW,
};

function grantFor(page: PermissionPage, grant: Grant | undefined): PagePermissionFlags {
  const base: PagePermissionFlags = page.viewOnly
    ? { canView: grant?.canView === true }
    : {
        canView: grant?.canView === true,
        canCreate: grant?.canCreate === true,
        canEdit: grant?.canEdit === true,
        canDelete: grant?.canDelete === true,
      };
  for (const [key, value] of Object.entries(grant ?? {})) {
    if (key in base) continue;
    if (key === "scope" ? page.scope?.options.some((o) => o.value === value) : page.extras.some((e) => e.key === key)) {
      base[key] = value;
    }
  }
  return base;
}

function grantAll(page: PermissionPage, level: "viewer" | "editor" | "admin"): PagePermissionFlags {
  // O Visualizador não vê o financeiro: quem só consulta não tem por que ver
  // as contas da empresa. Antes ele nascia com Lançamentos, Carteiras e Notas.
  if (level === "viewer") return grantFor(page, page.requiresFinancial ? undefined : VIEW);
  if (level === "editor") return grantFor(page, WORK);
  // "Acesso completo às telas": tudo, inclusive as ações finas que nascem
  // fechadas (reabrir OS) e as comissões.
  const extras: Grant = {};
  for (const extra of page.extras) extras[extra.key] = true;
  return grantFor(page, { ...FULL, ...extras });
}

/**
 * Permissões iniciais de um MEMBER novo, derivadas do catálogo. Chave fina
 * que o perfil não define fica de fora do doc e vale o fallback do catálogo.
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
  const table =
    roleType === "technician" ? TECHNICIAN : roleType === "seller" ? SELLER : roleType === "finance" ? FINANCE : null;

  for (const page of getAssignablePages(hasFinancial)) {
    permissions[page.id] = table
      ? grantFor(page, table[page.id])
      : grantAll(page, roleType as "viewer" | "editor" | "admin");
  }

  return permissions;
}
