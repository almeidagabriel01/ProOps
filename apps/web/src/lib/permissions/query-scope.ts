/**
 * "Só os meus" nas consultas do SDK. As rules do Firestore recortam pelo
 * alcance (`scope`) do doc de permissão da página, e regra não é filtro: a
 * lista de um membro com "own" que não traga o `where` do dono é recusada
 * inteira. Por isso todo service que lista uma coleção com alcance pergunta
 * aqui antes de montar a consulta.
 *
 * Quem publica o alcance é o `PermissionsProvider`, na renderização (antes de
 * qualquer efeito das telas). Enquanto as permissões carregam, quem pergunta
 * espera: montar a consulta sem saber o alcance seria pedir uma lista que as
 * rules recusam. Sem provedor (testes, páginas públicas), vale "all".
 *
 * Para quem tem o alcance restrito, a consulta vira só igualdade (empresa e
 * dono), sem índice composto novo, e o resto (ordem, filtro, página) é feito
 * na memória: o volume de uma pessoa é pequeno.
 */

import { where, type QueryConstraint } from "firebase/firestore";

export type ScopedPageId = "proposals" | "clients" | "kanban" | "projects" | "spreadsheets" | "transactions";

/** O campo do dono de cada coleção com alcance. */
export const SCOPE_OWNER_FIELD = {
  proposals: "sellerId",
  clients: "responsibleMemberId",
  kanban: "ownerId",
  projects: "assigneeId",
  spreadsheets: "createdById",
  transactions: "sellerId",
} as const satisfies Record<ScopedPageId, string>;

export interface ViewerScope {
  uid: string | null;
  /** Alcance por página; ausente vale "all". */
  byPage: Partial<Record<ScopedPageId, string>>;
}

const ALL: ViewerScope = { uid: null, byPage: {} };
const WAIT_LIMIT_MS = 8000;

let current: ViewerScope | null = ALL;
let waiters: Array<() => void> = [];

/** `null` enquanto as permissões carregam. Chamado pelo provedor. */
export function publishViewerScope(next: ViewerScope | null): void {
  current = next;
  if (next) {
    const pending = waiters;
    waiters = [];
    for (const resolve of pending) resolve();
  }
}

/** Só para testes: volta ao padrão (sem provedor, tudo). */
export function resetViewerScope(): void {
  publishViewerScope(ALL);
}

export async function viewerScope(): Promise<ViewerScope> {
  if (current) return current;
  await new Promise<void>((resolve) => {
    waiters.push(resolve);
    setTimeout(resolve, WAIT_LIMIT_MS);
  });
  return current ?? ALL;
}

/**
 * O dono pelo qual filtrar a coleção da página, ou null quando a pessoa vê
 * tudo. Em Lançamentos, "mine" filtra pelo vendedor; "income" é outro recorte
 * (`transactionScope`).
 */
export async function ownerFilter(pageId: ScopedPageId): Promise<{ field: string; uid: string } | null> {
  const scope = await viewerScope();
  const value = scope.byPage[pageId] ?? "all";
  const restricted = pageId === "transactions" ? value === "mine" : value === "own";
  if (!restricted || !scope.uid) return null;
  return { field: SCOPE_OWNER_FIELD[pageId], uid: scope.uid };
}

export async function transactionScope(): Promise<"all" | "income" | "mine"> {
  const value = (await viewerScope()).byPage.transactions;
  return value === "income" || value === "mine" ? value : "all";
}

/** Quem vê tudo numa página com alcance (síncrono, para a tela decidir o que mostrar). */
export function currentScopeOf(pageId: ScopedPageId): string {
  return current?.byPage[pageId] ?? "all";
}

/**
 * O recorte de Lançamentos para entrar em toda consulta da coleção:
 * "só receitas" pelo tipo, "só os das minhas vendas" pelo vendedor.
 */
export async function transactionScopeWhere(): Promise<QueryConstraint[]> {
  const scope = await transactionScope();
  if (scope === "income") return [where("type", "==", "income")];
  if (scope === "mine") {
    const owner = await ownerFilter("transactions");
    return owner ? [where(owner.field, "==", owner.uid)] : [];
  }
  return [];
}
