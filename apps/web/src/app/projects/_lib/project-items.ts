import type { PricingDefinition } from "@/lib/niches/config-types";
import {
  getProposalProductMeasurementLabel,
  type ProposalProductPricingDetails,
} from "@/lib/product-pricing";
import type { ProjectItem, ProjectItemMeasure, ProjectItemStatus } from "@/types/project";

/**
 * Itens da obra: os produtos da proposta, com a situação de compra e de
 * instalação. Sem valor nenhum (o backend copia só os campos permitidos).
 */

export const PROJECT_ITEM_STATUS_LABELS: Record<ProjectItemStatus, string> = {
  pending: "Pendente",
  purchase_requested: "Compra solicitada",
  in_stock: "Em estoque",
  installed: "Instalado",
};

/** O verbo do botão da ação em lote. */
export const PROJECT_ITEM_STATUS_ACTIONS: Record<ProjectItemStatus, string> = {
  pending: "Voltar para pendente",
  purchase_requested: "Solicitar compra",
  in_stock: "Em estoque",
  installed: "Instalado",
};

export const PROJECT_ITEM_STATUSES = Object.keys(PROJECT_ITEM_STATUS_LABELS) as ProjectItemStatus[];

export interface ProjectItemCounts {
  total: number;
  installed: number;
  /** Tudo que ainda não foi instalado, inclusive o que já está em estoque. */
  pending: number;
  byStatus: Record<ProjectItemStatus, number>;
  /** 0 a 100, pelos instalados. */
  percent: number;
}

export function countProjectItems(items: ProjectItem[]): ProjectItemCounts {
  const byStatus: Record<ProjectItemStatus, number> = {
    pending: 0,
    purchase_requested: 0,
    in_stock: 0,
    installed: 0,
  };
  for (const item of items) byStatus[item.status] = (byStatus[item.status] ?? 0) + 1;
  const total = items.length;
  return {
    total,
    installed: byStatus.installed,
    pending: total - byStatus.installed,
    byStatus,
    percent: total === 0 ? 0 : Math.round((byStatus.installed / total) * 100),
  };
}

export type ProjectItemFilter = "all" | "pending" | "installed";

export function filterProjectItems(items: ProjectItem[], filter: ProjectItemFilter): ProjectItem[] {
  if (filter === "installed") return items.filter((i) => i.status === "installed");
  if (filter === "pending") return items.filter((i) => i.status !== "installed");
  return items;
}

export interface ProjectItemGroup {
  key: string;
  /** O local da obra; null quando a linha não tinha grupo na proposta. */
  placeName: string | null;
  /**
   * O grupo da proposta, só quando difere do local. Na proposta por local
   * (persianas, vidros, móveis) os dois são o mesmo nome e mostrar os dois
   * repetiria a palavra.
   */
  groupName: string | null;
  items: ProjectItem[];
}

/** Agrupa por grupo e local, na ordem em que aparecem na proposta. */
export function groupProjectItems(items: ProjectItem[]): ProjectItemGroup[] {
  const groups = new Map<string, ProjectItemGroup>();
  for (const item of items) {
    const key = `${item.groupName ?? ""}\u0000${item.placeName ?? ""}`;
    let group = groups.get(key);
    if (!group) {
      const placeName = item.placeName ?? item.groupName ?? null;
      group = {
        key,
        placeName,
        groupName: item.groupName && item.groupName !== placeName ? item.groupName : null,
        items: [],
      };
      groups.set(key, group);
    }
    group.items.push(item);
  }
  // A linha sem grupo vai para o fim, depois das que têm.
  return [...groups.values()].sort((a, b) => Number(a.placeName === null) - Number(b.placeName === null));
}

/**
 * A medida do item, como a proposta mostra ("1,80 m x 2,40 m"), só no nicho
 * que cobra por medida (`pricing.dimensionModes`): é o que o instalador
 * confere no vão. Em automação e segurança não há medida, e nada aparece.
 */
export function formatProjectItemMeasure(
  item: Pick<ProjectItem, "measure" | "quantity">,
  pricing: Pick<PricingDefinition, "dimensionModes" | "measureLabels">,
): string | null {
  const measure = item.measure;
  if (!measure || measure.width <= 0) return null;
  if (!pricing.dimensionModes.includes(measure.mode)) return null;
  return getProposalProductMeasurementLabel({ pricingDetails: toPricingDetails(measure), quantity: item.quantity }, pricing);
}

/** A medida guardada na obra não tem a área nem a faixa de preço; o rótulo não usa nenhuma das duas. */
function toPricingDetails(measure: ProjectItemMeasure): ProposalProductPricingDetails {
  if (measure.mode === "curtain_meter") return { ...measure, area: measure.width * measure.height };
  if (measure.mode === "curtain_height") return { ...measure, tierId: "" };
  return measure;
}

export function formatProjectItemQuantity(quantity: number): string {
  return `Qtd. ${quantity.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------------------
// Resposta imediata: a situação marcada aparece antes de o servidor confirmar.
// ---------------------------------------------------------------------------

export type ItemStatusOverlay = Record<string, ProjectItemStatus>;

export function applyItemOverlay(items: ProjectItem[], overlay: ItemStatusOverlay): ProjectItem[] {
  if (Object.keys(overlay).length === 0) return items;
  return items.map((item) =>
    overlay[item.id] && overlay[item.id] !== item.status ? { ...item, status: overlay[item.id] } : item,
  );
}

/** Tira da camada o que o listener já mostra igual (ou o item que sumiu). */
export function pruneItemOverlay(items: ProjectItem[], overlay: ItemStatusOverlay): ItemStatusOverlay {
  const byId = new Map(items.map((item) => [item.id, item.status]));
  let changed = false;
  const next: ItemStatusOverlay = {};
  for (const [id, status] of Object.entries(overlay)) {
    if (byId.get(id) === undefined || byId.get(id) === status) {
      changed = true;
      continue;
    }
    next[id] = status;
  }
  return changed ? next : overlay;
}

export function dropFromItemOverlay(overlay: ItemStatusOverlay, ids: string[]): ItemStatusOverlay {
  const next = { ...overlay };
  for (const id of ids) delete next[id];
  return next;
}
