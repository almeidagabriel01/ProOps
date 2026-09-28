import type { LucideIcon } from "lucide-react";

import type { NichePageKey } from "@/lib/niches/config-types";
import type { PlanFeatures, PlanTier } from "@/types";

/**
 * O catálogo do que o ERP faz, a fonte da página `/funcionalidades`, dos cinco
 * destaques da home e do bloco "plataforma" das landings de nicho.
 *
 * O requisito de plano de cada recurso é declarado pela CHAVE que o produto
 * usa para bloquear (`PlanFeatures`), nunca pelo nome do plano. O selo que o
 * visitante lê ("A partir do Profissional", "Add-on no Starter") é derivado
 * disso em `selo-do-plano.ts`: escrever "Pro" aqui à mão seria a segunda cópia
 * da matriz de planos, e ela sairia do lugar na primeira mudança de catálogo.
 */

export type ChaveBooleana = {
  [K in keyof PlanFeatures]: PlanFeatures[K] extends boolean ? K : never;
}[keyof PlanFeatures];

export type ChaveNumerica = {
  [K in keyof PlanFeatures]: PlanFeatures[K] extends number ? K : never;
}[keyof PlanFeatures];

/**
 * - `livre`: nenhum gate de plano no produto; está em todo plano pago.
 * - `plano`: libera quando TODAS as chaves estão ligadas (booleanas) ou acima de
 *   zero (numéricas).
 * - `tier`: o raro recurso que o backend bloqueia por tier e não por chave
 *   (hoje só a escrita de textos pela IA, `ALLOWED_PLANS` em
 *   `apps/functions/src/ai/field-gen.route.ts`). O teste do selo lê aquele
 *   arquivo e reprova se os dois divergirem.
 */
export type Requisito =
  | { tipo: "livre" }
  | {
      tipo: "plano";
      recursos?: readonly ChaveBooleana[];
      limites?: readonly ChaveNumerica[];
    }
  | { tipo: "tier"; minimo: PlanTier };

export type CategoriaId =
  | "vendas"
  | "relacionamento"
  | "links"
  | "obra"
  | "financeiro"
  | "fiscal"
  | "catalogo"
  | "lia"
  | "plataforma";

export interface Categoria {
  id: CategoriaId;
  titulo: string;
  /** Uma frase: o que essa área resolve, do ponto de vista de quem vende projeto. */
  resumo: string;
  icone: LucideIcon;
}

/** Como um limite numérico é dito em português, com a concordância certa. */
export interface UnidadeDoLimite {
  /** "planilha" */
  um: string;
  /** "planilhas" */
  varios: string;
  /** "ilimitadas" */
  ilimitado: string;
  /** "por mês" */
  sufixo?: string;
}

/**
 * Onde o recurso depende do nicho: o preço por medida só existe onde o nicho
 * tem modo de medida, e os pacotes prontos (soluções, ambientes) só nos nichos
 * em que a tela está ligada. Derivado de `NICHE_CONFIGS`, nunca listado à mão:
 * um nicho novo entra sozinho.
 */
export type DisponibilidadePorNicho = "preco-por-medida" | NichePageKey;

export interface Recurso {
  /** kebab-case e único: vira âncora (`/funcionalidades#aceite-online`). */
  id: string;
  categoria: CategoriaId;
  titulo: string;
  /** Uma linha. */
  resumo: string;
  /** Duas a quatro frases curtas, concretas. */
  detalhes: readonly string[];
  icone: LucideIcon;
  requisito: Requisito;
  /** Escada do limite por plano, derivada ("5 no Starter, 50 no Profissional..."). */
  limite?: { chave: ChaveNumerica; unidade: UnidadeDoLimite };
  /** A tela do ERP onde o recurso vive. O teste confere que a rota existe. */
  rota?: `/${string}`;
  /** Rótulo humano da rota: "Financeiro › DRE". */
  ondeFica?: string;
  /** Página pública de exemplo, navegável sem conta. */
  exemplo?: { rotulo: string; href: `/share/${"portal" | "contador"}/exemplo` };
  nichos?: DisponibilidadePorNicho;
}

/** Um dos cinco destaques da home: um recurso principal e os que ele puxa. */
export interface Destaque {
  id: string;
  titulo: string;
  frase: string;
  /** O recurso cujo selo o destaque mostra. */
  principal: string;
  /** Ids do catálogo que o destaque reúne, na ordem em que são citados. */
  recursos: readonly string[];
  /** Capítulo de `/funcionalidades` para onde "Ver no mapa" leva. */
  ancora: CategoriaId;
}
