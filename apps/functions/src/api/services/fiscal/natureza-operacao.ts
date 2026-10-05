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
 *
 * Venda é o caso de quase toda nota, e nasce da proposta. As outras são as
 * notas sem venda que o instalador emite no dia a dia: mandar um amplificador
 * para o conserto, devolver uma compra ao fornecedor, levar um equipamento
 * para demonstração. Elas nascem da nota avulsa, digitada na hora.
 */
export type NaturezaOperacao =
  | "venda_mercadoria_terceiros"
  | "venda_producao_propria"
  | "devolucao_compra"
  | "remessa_conserto"
  | "retorno_conserto"
  | "remessa_demonstracao"
  | "retorno_demonstracao"
  | "outras_saidas";

/**
 * Se a nota de origem entra no documento (`refNFe`).
 *
 * `obrigatoria` só na devolução: a SEFAZ recusa a devolução sem a chave da
 * nota devolvida. Nos retornos ela é recomendada (amarra a saída à entrada
 * que a originou) e alguns estados a cobram, então o campo aparece, mas sem
 * travar quem não tem a chave à mão.
 */
export type ReferenciaNota = "obrigatoria" | "opcional" | "nao_se_aplica";

export type FinalidadeNota = "normal" | "devolucao";

interface NaturezaDefinition {
  /** Same UF as the issuer. */
  dentroEstado: string;
  /** Different UF. */
  foraEstado: string;
  /** Abroad — 7xxx. Absent when the operation cannot be an export. */
  exterior?: string;
  descricao: string;
  /**
   * Se a operação é tributada pelo ICMS da forma comum (a venda).
   *
   * Remessa e retorno não são venda: a mercadoria sai e volta sem mudar de
   * dono, e a nota existe para acobertar o transporte. Com `false` a situação
   * do ICMS deixa de vir do produto (que descreve a VENDA dele) e passa a vir
   * da operação. Ver `deriveSituacaoTributariaOperacao`.
   */
  tributada: boolean;
  /** `finNFe`: a devolução tem finalidade própria (4). */
  finalidade: FinalidadeNota;
  referencia: ReferenciaNota;
}

const NATUREZAS: Record<NaturezaOperacao, NaturezaDefinition> = {
  venda_mercadoria_terceiros: {
    dentroEstado: "5102",
    foraEstado: "6102",
    exterior: "7102",
    descricao: "Venda de mercadoria adquirida de terceiros",
    tributada: true,
    finalidade: "normal",
    referencia: "nao_se_aplica",
  },
  venda_producao_propria: {
    dentroEstado: "5101",
    foraEstado: "6101",
    exterior: "7101",
    descricao: "Venda de produção do estabelecimento",
    tributada: true,
    finalidade: "normal",
    referencia: "nao_se_aplica",
  },
  devolucao_compra: {
    dentroEstado: "5202",
    foraEstado: "6202",
    descricao: "Devolução de compra para comercialização",
    tributada: false,
    finalidade: "devolucao",
    referencia: "obrigatoria",
  },
  remessa_conserto: {
    dentroEstado: "5915",
    foraEstado: "6915",
    descricao: "Remessa para conserto ou reparo",
    tributada: false,
    finalidade: "normal",
    referencia: "nao_se_aplica",
  },
  retorno_conserto: {
    dentroEstado: "5916",
    foraEstado: "6916",
    descricao: "Retorno de mercadoria recebida para conserto ou reparo",
    tributada: false,
    finalidade: "normal",
    referencia: "opcional",
  },
  remessa_demonstracao: {
    dentroEstado: "5912",
    foraEstado: "6912",
    descricao: "Remessa para demonstração",
    tributada: false,
    finalidade: "normal",
    referencia: "nao_se_aplica",
  },
  retorno_demonstracao: {
    dentroEstado: "5913",
    foraEstado: "6913",
    descricao: "Retorno de mercadoria recebida para demonstração",
    tributada: false,
    finalidade: "normal",
    referencia: "opcional",
  },
  outras_saidas: {
    dentroEstado: "5949",
    foraEstado: "6949",
    descricao: "Outra saída de mercadoria não especificada",
    tributada: false,
    finalidade: "normal",
    referencia: "opcional",
  },
};

export function isNaturezaOperacao(value: unknown): value is NaturezaOperacao {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(NATUREZAS, value);
}

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

export interface NaturezaResumo {
  id: NaturezaOperacao;
  descricao: string;
  /** CFOP dentro e fora do estado, para a tela mostrar o que vai sair. */
  cfopDentroEstado: string;
  cfopForaEstado: string;
  tributada: boolean;
  finalidade: FinalidadeNota;
  referencia: ReferenciaNota;
}

export function listNaturezas(): NaturezaResumo[] {
  return (Object.keys(NATUREZAS) as NaturezaOperacao[]).map((id) => ({
    id,
    descricao: NATUREZAS[id].descricao,
    cfopDentroEstado: NATUREZAS[id].dentroEstado,
    cfopForaEstado: NATUREZAS[id].foraEstado,
    tributada: NATUREZAS[id].tributada,
    finalidade: NATUREZAS[id].finalidade,
    referencia: NATUREZAS[id].referencia,
  }));
}

export function naturezaFinalidade(natureza: NaturezaOperacao): FinalidadeNota {
  return NATUREZAS[natureza].finalidade;
}

export function naturezaReferencia(natureza: NaturezaOperacao): ReferenciaNota {
  return NATUREZAS[natureza].referencia;
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

/**
 * Situação do ICMS de uma linha, considerando a OPERAÇÃO.
 *
 * Na venda vale a regra de sempre: o código do produto (substituição
 * tributária, benefício) vence o padrão do regime. Fora da venda o código do
 * produto não descreve esta nota, e mandá-lo faria uma remessa para conserto
 * sair tributada como venda. Ali o padrão é "outras": **900** no Simples, que
 * é o que a remessa para conserto da AWA usa (NF 50936, autorizada pela SEFAZ
 * de SC), e **90** no Regime Normal, o equivalente sem destaque. A pessoa
 * ainda troca linha a linha na nota (`noteOverride`), porque a suspensão do
 * conserto e o ICMS da devolução variam por estado e por compra.
 */
export function deriveSituacaoTributariaOperacao(
  regime: FiscalTaxRegime,
  natureza: NaturezaOperacao,
  catalogOverride?: string,
  noteOverride?: string,
): SituacaoTributaria {
  const nota = String(noteOverride || "").trim();
  if (nota) return deriveSituacaoTributaria(regime, nota);
  if (NATUREZAS[natureza]?.tributada !== false) {
    return deriveSituacaoTributaria(regime, catalogOverride);
  }
  const isSimples = regime === 1 || regime === 2 || regime === 4;
  return isSimples ? { kind: "csosn", codigo: "900" } : { kind: "cst", codigo: "90" };
}

/** Commercial units the SEFAZ accepts, mapped from what the catalogue stores. */
const UNIT_MAP: Record<string, string> = {
  unit: "UN",
  meter: "M",
};

/**
 * Maps the catalogue's `inventoryUnit` to a fiscal unit.
 * Anything unrecognized falls back to `UN`, the safe generic.
 *
 * O modo de preço vence o estoque quando cobra por ÁREA: o produto
 * `curtain_meter` guarda o estoque em metros, mas a quantidade da linha é
 * largura × altura × painéis, em m². Com "M" a nota saía com a unidade errada.
 */
export function deriveUnidadeComercial(
  inventoryUnit: string | undefined,
  pricingMode?: string,
): string {
  if (String(pricingMode || "").trim() === "curtain_meter") return "M2";
  const key = String(inventoryUnit || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(UNIT_MAP, key) ? UNIT_MAP[key] : "UN";
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
