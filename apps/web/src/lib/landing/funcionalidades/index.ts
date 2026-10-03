import { NICHE_CONFIGS } from "@/lib/niches/config";
import { NICHE_REGISTRY, TENANT_NICHES } from "@/lib/niches/registry";

import { RECURSOS_DE_ENTREGA } from "./recursos/entrega";
import { RECURSOS_DE_GESTAO } from "./recursos/gestao";
import { RECURSOS_DE_POS_VENDA } from "./recursos/pos-venda";
import { RECURSOS_DE_VENDA } from "./recursos/venda";
import type { DisponibilidadePorNicho, Recurso } from "./tipos";

export { DESTAQUES } from "./destaques";
export {
  FUNCIONALIDADES,
  GRUPOS_DE_FUNCIONALIDADES,
  funcionalidade,
  funcionalidadeDoRecurso,
} from "./funcionalidades";
export { FUNCIONALIDADE_SLUGS, caminhoDaFuncionalidade, type FuncionalidadeSlug } from "./slugs";
export { escadaDoLimite, seloDoPlano, type SeloDoPlano } from "./selo-do-plano";
export type * from "./tipos";

/** Tudo o que o ERP faz, recurso por recurso. */
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

/**
 * Os rótulos dos nichos em que um recurso existe, lidos da configuração de cada
 * nicho. Vazio quando o recurso vale para todos.
 */
export function nichosDoRecurso(disponibilidade: DisponibilidadePorNicho | undefined): string[] {
  if (!disponibilidade) return [];
  return TENANT_NICHES.filter((niche) => {
    const config = NICHE_CONFIGS[niche];
    if (disponibilidade === "preco-por-medida") return config.pricing.dimensionModes.length > 0;
    if (disponibilidade === "pmoc") return config.fieldService.pmoc;
    return config.pageAvailability[disponibilidade];
  }).map((niche) => NICHE_REGISTRY[niche].label);
}
