/**
 * Derives the fiscal fields the user should never have to think about.
 *
 * CFOP, CST/CSOSN and the commercial unit are mandatory on every NF-e line,
 * but none of them is a property of the product:
 *
 *  - CFOP is a property of the *operation* — the same curtain sold inside the
 *    state is 5102 and outside it is 6102. Storing it on the product is the
 *    classic modelling mistake that forces a manual fix on every interstate
 *    sale.
 *  - CST/CSOSN follows the issuer's tax regime, which is already on file.
 *  - The commercial unit is already in the catalogue as `inventoryUnit`.
 *
 * So the ERP asks for none of them. The only field a user really has to supply
 * per product is the NCM.
 */

import type { FiscalTaxRegime } from "./fiscal-types";

/**
 * Operation kinds the niche actually performs.
 * Each maps to a pair of CFOPs — one for inside the state, one for outside.
 */
export type NaturezaOperacao =
  | "venda_mercadoria_terceiros"
  | "venda_producao_propria"
  | "devolucao_compra"
  | "remessa_conserto"
  | "remessa_demonstracao";

interface NaturezaDefinition {
  /** Same UF as the issuer. */
  dentroEstado: string;
  /** Different UF. */
  foraEstado: string;
  /** Abroad — 7xxx. Absent when the operation cannot be an export. */
  exterior?: string;
  descricao: string;
}

const NATUREZAS: Record<NaturezaOperacao, NaturezaDefinition> = {
  venda_mercadoria_terceiros: {
    dentroEstado: "5102",
    foraEstado: "6102",
    exterior: "7102",
    descricao: "Venda de mercadoria adquirida de terceiros",
  },
  venda_producao_propria: {
    dentroEstado: "5101",
    foraEstado: "6101",
    exterior: "7101",
    descricao: "Venda de produção do estabelecimento",
  },
  devolucao_compra: {
    dentroEstado: "5202",
    foraEstado: "6202",
    descricao: "Devolução de compra para comercialização",
  },
  remessa_conserto: {
    dentroEstado: "5915",
    foraEstado: "6915",
    descricao: "Remessa para conserto ou reparo",
  },
  remessa_demonstracao: {
    dentroEstado: "5912",
    foraEstado: "6912",
    descricao: "Remessa para demonstração",
  },
};

/**
 * The default for an installer who buys equipment and resells it — which is
 * the operation the niche performs on essentially every sale.
 */
export const DEFAULT_NATUREZA: NaturezaOperacao = "venda_mercadoria_terceiros";

/** UF sentinel the SEFAZ uses for a foreign recipient. */
const UF_EXTERIOR = "EX";

export function describeNatureza(natureza: NaturezaOperacao): string {
  return NATUREZAS[natureza].descricao;
}

export function listNaturezas(): Array<{ id: NaturezaOperacao; descricao: string }> {
  return (Object.keys(NATUREZAS) as NaturezaOperacao[]).map((id) => ({
    id,
    descricao: NATUREZAS[id].descricao,
  }));
}

/**
 * Picks the CFOP from the operation and the two UFs.
 *
 * @throws when the operation has no export CFOP but the recipient is abroad —
 * silently falling back to an interstate code would produce a document the
 * SEFAZ accepts and the customs authority does not.
 */
export function deriveCfop(
  natureza: NaturezaOperacao,
  ufEmitente: string,
  ufDestinatario: string,
): string {
  const definition = NATUREZAS[natureza];
  if (!definition) {
    throw new Error(`NATUREZA_OPERACAO_DESCONHECIDA: ${natureza}`);
  }

  const origem = String(ufEmitente || "").trim().toUpperCase();
  const destino = String(ufDestinatario || "").trim().toUpperCase();

  if (destino === UF_EXTERIOR) {
    if (!definition.exterior) {
      throw new Error(`NATUREZA_SEM_CFOP_EXTERIOR: ${natureza}`);
    }
    return definition.exterior;
  }

  // A missing destination UF must not be guessed as "same state": that would
  // understate the tax on an interstate sale.
  if (!origem || !destino) {
    throw new Error("CFOP_UF_INDETERMINADA");
  }

  return origem === destino ? definition.dentroEstado : definition.foraEstado;
}

/**
 * CST de PIS/COFINS do item.
 *
 * A NF-e 4.00 exige os grupos PIS e COFINS em **todo** item — sem eles a SEFAZ
 * rejeita com **745** ("NF-e sem grupo do PIS"), que foi a primeira rejeição
 * real de conteúdo do módulo.
 *
 * No Simples Nacional o recolhimento é unificado no DAS, então a saída vai com
 * **CST 99** ("outras operações") e zeros — destacar base ou valor seria
 * declarar uma contribuição que a empresa não apura ali.
 *
 * Regime Normal apura PIS/COFINS de verdade, com alíquotas que dependem de ser
 * cumulativo (0,65% / 3%) ou não cumulativo (1,65% / 7,6%) — informação que o
 * cadastro não tem. Vai com **49** e zeros para não inventar um valor, e é o
 * primeiro campo a revisar quando existir um tenant fora do Simples.
 */
export function derivePisCofinsCst(regime: FiscalTaxRegime): string {
  const isSimples = regime === 1 || regime === 2 || regime === 4;
  return isSimples ? "99" : "49";
}

/** Which ICMS taxation field applies. They are mutually exclusive. */
export type SituacaoTributariaKind = "csosn" | "cst";

export interface SituacaoTributaria {
  kind: SituacaoTributariaKind;
  codigo: string;
}

/**
 * Default ICMS taxation for the issuer's regime.
 *
 * Simples Nacional reports CSOSN, everyone else reports CST. `102` and `00`
 * are the ordinary cases — a product under substituição tributária or a tax
 * benefit needs an explicit override, which is why the per-product value wins
 * when present.
 */
export function deriveSituacaoTributaria(
  regime: FiscalTaxRegime,
  override?: string,
): SituacaoTributaria {
  const isSimples = regime === 1 || regime === 2 || regime === 4;
  const kind: SituacaoTributariaKind = isSimples ? "csosn" : "cst";

  const explicit = String(override || "").trim();
  if (explicit) {
    return { kind, codigo: explicit };
  }

  return {
    kind,
    // 102 — tributada pelo Simples Nacional sem permissão de crédito.
    // 00  — tributada integralmente.
    codigo: isSimples ? "102" : "00",
  };
}

/** Commercial units the SEFAZ accepts, mapped from what the catalogue stores. */
const UNIT_MAP: Record<string, string> = {
  unit: "UN",
  meter: "M",
};

/**
 * Maps the catalogue's `inventoryUnit` to a fiscal unit.
 * Anything unrecognized falls back to `UN`, the safe generic.
 */
export function deriveUnidadeComercial(inventoryUnit: string | undefined): string {
  const key = String(inventoryUnit || "").trim().toLowerCase();
  return UNIT_MAP[key] || "UN";
}

/** Origem da mercadoria: 0 nacional … 8 nacional com conteúdo de importação > 70%. */
export const ORIGEM_NACIONAL = 0;
const ORIGEM_MAX = 8;

/**
 * Normalizes the origin code, defaulting to national.
 * An installer buying from a domestic distributor is always 0; anything else
 * is a deliberate choice the user makes.
 */
export function normalizeOrigem(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > ORIGEM_MAX) {
    return ORIGEM_NACIONAL;
  }
  return parsed;
}
