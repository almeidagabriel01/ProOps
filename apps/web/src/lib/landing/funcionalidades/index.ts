import { NICHE_CONFIGS } from "@/lib/niches/config";
import { NICHE_REGISTRY, TENANT_NICHES } from "@/lib/niches/registry";

import { CATEGORIAS } from "./categorias";
import { RECURSOS_DE_ENTREGA } from "./recursos/entrega";
import { RECURSOS_DE_GESTAO } from "./recursos/gestao";
import { RECURSOS_DE_POS_VENDA } from "./recursos/pos-venda";
import { RECURSOS_DE_VENDA } from "./recursos/venda";
import type { CategoriaId, DisponibilidadePorNicho, Recurso } from "./tipos";

export { CATEGORIAS, categoria } from "./categorias";
export { DESTAQUES } from "./destaques";
export { escadaDoLimite, seloDoPlano, type SeloDoPlano } from "./selo-do-plano";
export type * from "./tipos";

/** Tudo o que o ERP faz. A ordem de exibição é a das categorias. */
export const CATALOGO: readonly Recurso[] = [
  ...RECURSOS_DE_VENDA,
  ...RECURSOS_DE_ENTREGA,
  ...RECURSOS_DE_POS_VENDA,
  ...RECURSOS_DE_GESTAO,
];

export function recurso(id: string): Recurso {
  const encontrado = CATALOGO.find((r) => r.id === id);
  if (!encontrado) throw new Error(`Recurso desconhecido: ${id}`);
  return encontrado;
}

export function recursosDa(categoriaId: CategoriaId): Recurso[] {
  return CATALOGO.filter((r) => r.categoria === categoriaId);
}

/** O catálogo agrupado na ordem das categorias. */
export function capitulos() {
  return CATEGORIAS.map((c) => ({ categoria: c, recursos: recursosDa(c.id) }));
}

/**
 * Os rótulos dos nichos em que um recurso existe, lidos da configuração de cada
 * nicho. Vazio quando o recurso vale para todos.
 */
export function nichosDoRecurso(disponibilidade: DisponibilidadePorNicho | undefined): string[] {
  if (!disponibilidade) return [];
  return TENANT_NICHES.filter((niche) => {
    const config = NICHE_CONFIGS[niche];
    return disponibilidade === "preco-por-medida"
      ? config.pricing.dimensionModes.length > 0
      : config.pageAvailability[disponibilidade];
  }).map((niche) => NICHE_REGISTRY[niche].label);
}
