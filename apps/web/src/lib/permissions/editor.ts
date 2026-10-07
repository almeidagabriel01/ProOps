import {
  BASE_PERMISSION_ACTIONS,
  getPermissionPageDef,
  resolvePermissionKey,
  resolvePermissionScope,
  type PermissionPageDef,
} from "./catalog";
import type { MemberPermissions, PagePermissionFlags } from "./pages";

/**
 * Regras da tela de Equipe, puras. A tela mostra o valor EFETIVO de cada
 * chave (com o fallback do catálogo aplicado), para o dono ver o que o membro
 * pode hoje, e grava o valor explícito quando ele mexe.
 */

const BASE_LABELS: Record<string, string> = {
  canView: "Ver",
  canCreate: "Criar",
  canEdit: "Editar",
  canDelete: "Excluir",
};

export function effectiveValue(pageId: string, doc: PagePermissionFlags | undefined, key: string): boolean {
  return resolvePermissionKey(pageId, doc ?? null, key);
}

export function effectiveScope(pageId: string, doc: PagePermissionFlags | undefined): string | null {
  return resolvePermissionScope(pageId, doc ?? null);
}

/**
 * O doc depois de mudar uma chave, com a cascata da gravação: desligar "Ver"
 * desliga as ações (básicas e finas) e põe o escopo no mais restrito; dado
 * sensível fica como estava. O backend aplica a mesma regra.
 */
export function applyPermissionChange(
  pageId: string,
  doc: PagePermissionFlags | undefined,
  key: string,
  value: boolean | string,
): PagePermissionFlags {
  const page = getPermissionPageDef(pageId);
  const next: PagePermissionFlags = { canView: doc?.canView === true, ...(doc ?? {}), [key]: value } as PagePermissionFlags;
  if (key === "canView" && value === false && page) {
    for (const action of BASE_PERMISSION_ACTIONS) if (action !== "canView") next[action] = false;
    for (const extra of page.extras) if (extra.kind === "action") next[extra.key] = false;
    if (page.scope) next.scope = page.scope.narrowest;
  }
  return next;
}

export interface PermissionChange {
  pageId: string;
  label: string;
  from: string;
  to: string;
}

function keyLabel(page: PermissionPageDef, key: string): string {
  return BASE_LABELS[key] ?? page.extras.find((e) => e.key === key)?.label ?? key;
}

function scopeLabel(page: PermissionPageDef, value: string | null): string {
  return page.scope?.options.find((o) => o.value === value)?.label ?? "";
}

/**
 * O que muda, em valor efetivo, entre dois conjuntos de permissões: a prévia
 * de "Aplicar perfil" e de "Copiar de outro membro". Só aparece o que muda de
 * verdade para o membro (uma chave gravada igual ao fallback não é mudança).
 */
export function diffPermissions(
  before: MemberPermissions,
  after: MemberPermissions,
  pages: readonly PermissionPageDef[],
  pageName: (page: PermissionPageDef) => string = (page) => page.name,
): PermissionChange[] {
  const changes: PermissionChange[] = [];
  for (const page of pages) {
    const keys = [
      ...(page.viewOnly ? ["canView"] : BASE_PERMISSION_ACTIONS),
      ...page.extras.map((e) => e.key),
    ];
    for (const key of keys) {
      const a = effectiveValue(page.id, before[page.id], key);
      const b = effectiveValue(page.id, after[page.id], key);
      if (a !== b) {
        changes.push({
          pageId: page.id,
          label: `${pageName(page)}: ${keyLabel(page, key)}`,
          from: a ? "sim" : "não",
          to: b ? "sim" : "não",
        });
      }
    }
    if (page.scope) {
      const a = effectiveScope(page.id, before[page.id]);
      const b = effectiveScope(page.id, after[page.id]);
      if (a !== b) {
        changes.push({
          pageId: page.id,
          label: `${pageName(page)}: alcance`,
          from: scopeLabel(page, a),
          to: scopeLabel(page, b),
        });
      }
    }
  }
  return changes;
}

/** Busca da tela: nome, descrição e rótulo das chaves de cada página. */
export function matchesPermissionSearch(page: PermissionPageDef, name: string, term: string): boolean {
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
  const needle = normalize(term.trim());
  if (!needle) return true;
  const haystack = [name, page.description, ...page.extras.flatMap((e) => [e.label, e.description])]
    .map(normalize)
    .join(" ");
  return haystack.includes(needle);
}
