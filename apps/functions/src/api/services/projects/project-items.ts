import { randomUUID } from "node:crypto";
import { z } from "zod";
import { normalizeProposalPricingDetails } from "../../../shared/dimension-pricing";

/**
 * Itens da obra: os produtos da proposta, copiados para o projeto para quem
 * compra e quem instala acompanhar cada um ("solicitar compra", "em estoque",
 * "instalado").
 *
 * **Nenhum valor entra aqui.** O projeto é lido direto do Firestore por todo
 * membro com Projetos, e o técnico não pode ver preço, total nem forma de
 * pagamento. Por isso a cópia é por lista de campos permitidos (nunca um
 * spread da linha da proposta): um campo de preço novo na proposta não vaza
 * sozinho para cá.
 *
 * Só produtos. Serviço ("instalação", "configuração") não se compra nem se
 * instala como peça; o andamento dele é o das etapas.
 *
 * É uma cópia: mudar a proposta depois não muda a lista, e marcar um item não
 * mexe em estoque nem no financeiro.
 */

export const PROJECT_ITEM_STATUSES = ["pending", "purchase_requested", "in_stock", "installed"] as const;
export type ProjectItemStatus = (typeof PROJECT_ITEM_STATUSES)[number];

/** Teto da lista: o documento do projeto tem limite de tamanho. */
export const MAX_PROJECT_ITEMS = 500;

/**
 * A medida da linha, para persianas, vidros e móveis por medida. Os mesmos
 * campos de `pricingDetails`, sem a área nem a faixa de preço.
 */
export type ProjectItemMeasure =
  | { mode: "curtain_meter"; width: number; height: number; panels: number }
  | { mode: "curtain_width"; width: number; panels: number }
  | { mode: "curtain_height"; width: number; maxHeight: number; panels: number };

export interface ProjectItem {
  id: string;
  productId: string;
  name: string;
  manufacturer: string | null;
  /** Unidades a instalar; na linha por medida, as peças (folhas, vãos). */
  quantity: number;
  /** O grupo da proposta (solução, sistema). */
  groupName: string | null;
  /** O local da obra (ambiente, área). */
  placeName: string | null;
  measure: ProjectItemMeasure | null;
  status: ProjectItemStatus;
  statusAt: string | null;
  statusBy: string | null;
  statusByName: string | null;
}

/** Os únicos campos que um item tem. O teste afirma que nenhum outro aparece. */
export const PROJECT_ITEM_FIELDS = [
  "id",
  "productId",
  "name",
  "manufacturer",
  "quantity",
  "groupName",
  "placeName",
  "measure",
  "status",
  "statusAt",
  "statusBy",
  "statusByName",
] as const satisfies readonly (keyof ProjectItem)[];

interface ProposalLike {
  products?: unknown;
  sistemas?: unknown;
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function measureOf(pricingDetails: unknown): ProjectItemMeasure | null {
  const details = normalizeProposalPricingDetails(pricingDetails);
  if (details.mode === "standard" || details.width <= 0) return null;
  if (details.mode === "curtain_meter") {
    return { mode: details.mode, width: details.width, height: details.height, panels: details.panels };
  }
  if (details.mode === "curtain_width") {
    return { mode: details.mode, width: details.width, panels: details.panels };
  }
  return { mode: details.mode, width: details.width, maxHeight: details.maxHeight, panels: details.panels };
}

/** Grupo e local de cada linha, pela chave `sistemaId-ambienteId` da proposta. */
function placesOf(sistemas: unknown): Map<string, { groupName: string | null; placeName: string | null }> {
  const places = new Map<string, { groupName: string | null; placeName: string | null }>();
  if (!Array.isArray(sistemas)) return places;
  for (const raw of sistemas) {
    if (!raw || typeof raw !== "object") continue;
    const sistema = raw as Record<string, unknown>;
    const groupName = text(sistema.sistemaName, 160) || null;
    const ambientes = Array.isArray(sistema.ambientes) ? sistema.ambientes : [];
    for (const rawAmbiente of ambientes) {
      if (!rawAmbiente || typeof rawAmbiente !== "object") continue;
      const ambiente = rawAmbiente as Record<string, unknown>;
      places.set(`${String(sistema.sistemaId ?? "")}-${String(ambiente.ambienteId ?? "")}`, {
        groupName,
        placeName: text(ambiente.ambienteName, 160) || null,
      });
    }
  }
  return places;
}

/**
 * Os itens da obra a partir da proposta: produtos ativos, sem serviço, sem
 * linha inativa e sem nenhum valor. Tudo nasce pendente.
 */
export function buildProjectItemsFromProposal(
  proposal: ProposalLike,
  newId: () => string = randomUUID,
): ProjectItem[] {
  const lines = Array.isArray(proposal.products) ? proposal.products : [];
  const places = placesOf(proposal.sistemas);
  const usedIds = new Set<string>();
  const items: ProjectItem[] = [];

  for (const raw of lines) {
    if (items.length >= MAX_PROJECT_ITEMS) break;
    if (!raw || typeof raw !== "object") continue;
    const line = raw as Record<string, unknown>;
    if (line.itemType === "service") continue;
    if (line.status === "inactive" || line._isInactive === true) continue;

    const name = text(line.productName, 300) || text(line.name, 300);
    if (!name) continue;

    const measure = measureOf(line.pricingDetails);
    const rawQuantity = Number(line.quantity);
    const quantity = measure
      ? measure.panels
      : Number.isFinite(rawQuantity) && rawQuantity > 0
        ? Math.round(rawQuantity * 100) / 100
        : 1;

    const lineItemId = text(line.lineItemId, 160);
    const id = lineItemId && !usedIds.has(lineItemId) ? lineItemId : newId();
    usedIds.add(id);

    const place = places.get(text(line.ambienteInstanceId, 200) || text(line.systemInstanceId, 200));
    items.push({
      id,
      productId: text(line.productId, 160),
      name,
      manufacturer: text(line.manufacturer, 160) || null,
      quantity,
      groupName: place?.groupName ?? null,
      placeName: place?.placeName ?? null,
      measure,
      status: "pending",
      statusAt: null,
      statusBy: null,
      statusByName: null,
    });
  }
  return items;
}

/**
 * Aplica a mesma situação a vários itens. Item que já estava nela não muda (a
 * data e o autor continuam os da primeira marcação). Devolve quantos mudaram;
 * id que não existe na lista é erro de quem chamou.
 */
export function applyItemsStatus(
  items: ProjectItem[],
  itemIds: string[],
  status: ProjectItemStatus,
  actor: { uid: string; name: string | null; now: string },
): { items: ProjectItem[]; changed: number; missing: string[] } {
  const wanted = new Set(itemIds);
  const known = new Set(items.map((item) => item.id));
  const missing = [...wanted].filter((id) => !known.has(id));
  let changed = 0;
  const next = items.map((item) => {
    if (!wanted.has(item.id) || item.status === status) return item;
    changed++;
    return { ...item, status, statusAt: actor.now, statusBy: actor.uid, statusByName: actor.name };
  });
  return { items: next, changed, missing };
}

export const UpdateItemsStatusSchema = z
  .object({
    itemIds: z.array(z.string().trim().min(1).max(160)).min(1, "Escolha ao menos um item.").max(MAX_PROJECT_ITEMS),
    status: z.enum(PROJECT_ITEM_STATUSES, { message: "Situação do item inválida." }),
  })
  .strict();
