import type { Proposal } from "@/types/proposal";

export interface EquipmentDraft {
  key: string;
  selected: boolean;
  name: string;
  brand: string;
  serialNumber: string;
  location: string;
}

/** Teto de linhas: uma proposta com 200 luminárias não vira 200 aparelhos por engano. */
export const MAX_DRAFTS_PER_LINE = 10;
export const MAX_DRAFTS = 50;

/**
 * Os aparelhos que a obra instalou, a partir das linhas de PRODUTO da
 * proposta: uma linha por unidade (dois splits são dois aparelhos, cada um
 * com a sua série), com o local vindo do ambiente da linha. Serviço e linha
 * inativa ficam de fora. Tudo nasce marcado; quem registra desmarca o que é
 * material (tubulação, cabo) e não equipamento.
 */
export function equipmentDraftsFromProposal(
  proposal: Pick<Proposal, "products" | "sistemas">,
): EquipmentDraft[] {
  const places = new Map<string, string>();
  for (const sistema of proposal.sistemas ?? []) {
    for (const ambiente of sistema.ambientes ?? []) {
      places.set(`${sistema.sistemaId}-${ambiente.ambienteId}`, ambiente.ambienteName);
    }
  }

  const drafts: EquipmentDraft[] = [];
  (proposal.products ?? []).forEach((line, lineIndex) => {
    if (line.itemType === "service" || line.status === "inactive" || line._isInactive) return;
    const units = Math.min(MAX_DRAFTS_PER_LINE, Math.max(1, Math.round(Number(line.quantity) || 1)));
    const name = line.productName || line.name || "Equipamento";
    const location = places.get(line.ambienteInstanceId ?? "") ?? "";
    for (let unit = 1; unit <= units && drafts.length < MAX_DRAFTS; unit++) {
      drafts.push({
        key: `${lineIndex}-${unit}`,
        selected: true,
        name: units > 1 ? `${name} (${unit}/${units})` : name,
        brand: line.manufacturer ?? "",
        serialNumber: "",
        location,
      });
    }
  });
  return drafts;
}

/** A garantia de fábrica mais comum; a pessoa ajusta no cadastro de cada aparelho. */
export function addMonthsToDay(day: string, months: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}
