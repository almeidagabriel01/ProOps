import type { LucideIcon } from "lucide-react";

import type { NichePageKey } from "@/lib/niches/config-types";
import type { PlanFeatures, PlanTier } from "@/types";

import type { FuncionalidadeSlug } from "./slugs";

/**
 * O catálogo do que o ERP faz: os recursos (o detalhe, com o plano de cada
 * um) e as funcionalidades que os reúnem (uma página cada em
 * `/funcionalidades/<slug>`). Alimenta a lista de `/funcionalidades`, os cinco
 * destaques da home e o bloco "plataforma" das landings de nicho.
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
 * tem modo de medida, o PMOC só onde `fieldService.pmoc` está ligado, e os
 * pacotes prontos (soluções, ambientes) só nos nichos em que a tela está ligada. Derivado de `NICHE_CONFIGS`, nunca listado à mão:
 * um nicho novo entra sozinho.
 */
export type DisponibilidadePorNicho = "preco-por-medida" | "pmoc" | NichePageKey;

export interface Recurso {
  /** kebab-case e único: vira âncora na página da funcionalidade que o reúne. */
  id: string;
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

export type GrupoId = "vender" | "entregar" | "receber" | "gerir";

export interface GrupoDeFuncionalidades {
  id: GrupoId;
  titulo: string;
  resumo: string;
}

/** Uma funcionalidade como o cliente a chama, com a página própria dela. */
export interface Funcionalidade {
  slug: FuncionalidadeSlug;
  titulo: string;
  /** A explicação curta da lista: uma linha. */
  resumo: string;
  icone: LucideIcon;
  grupo: GrupoId;
  /** O recurso cujo selo de plano a lista mostra. */
  principal: string;
  /** Ids do catálogo que ela reúne, na ordem da página. */
  recursos: readonly string[];
  pagina: {
    /** O título da página, antes do termo em itálico. */
    titulo: string;
    /** O termo em itálico que fecha o título. */
    destaque: string;
    intro: string;
    /** Como funciona, em três passos. */
    passos: readonly { titulo: string; texto: string }[];
  };
  /** Outras funcionalidades para seguir lendo. */
  relacionadas: readonly FuncionalidadeSlug[];
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
  /** A página que o destaque abre. */
  funcionalidade: FuncionalidadeSlug;
}
