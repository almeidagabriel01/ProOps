/**
 * ICMS, PIS e COFINS de cada linha da NF-e: de onde vem cada número e como ele
 * é calculado.
 *
 * Puro, sem Firestore. É o único lugar que decide os impostos da linha, para
 * as duas origens da nota (proposta e avulsa), para a prévia e para a emissão.
 *
 * **Precedência, imposto a imposto** (o objeto inteiro, não campo a campo):
 *
 *  1. a edição da linha na própria nota;
 *  2. o padrão fiscal do contato, só nas operações tributadas (uma remessa
 *     para conserto não herda o CSOSN de venda do cliente);
 *  3. o padrão: situação do ICMS pela operação e pelo regime (com o código
 *     do produto valendo na venda) e PIS/COFINS pelo regime, zerados.
 *
 * Sem edição e sem padrão do contato, a linha sai exatamente como saía antes
 * deste módulo: CSOSN 102 (ou 900 fora da venda) e PIS/COFINS 99 zerados.
 *
 * O que falta para a nota sair (alíquota de um CST tributado, crédito do 101)
 * volta como problema, com a origem, para virar lacuna no lugar certo: na
 * linha, no contato ou nas configurações da empresa.
 */

import {
  derivePisCofinsCst,
  deriveSituacaoTributariaOperacao,
  isNaturezaTributada,
  type NaturezaOperacao,
} from "./natureza-operacao";
import { findIcmsSituacao, findPisCofinsCst, icmsKindForRegime } from "./tax-codes";
import type { FiscalIcms, FiscalPisCofins, FiscalTaxRegime } from "./fiscal-types";

export interface IcmsEdit {
  situacao?: string;
  /** Percentual de redução da base (CST 20). */
  reducaoBase?: number;
  baseCalculo?: number;
  aliquota?: number;
  valor?: number;
  aliquotaCredito?: number;
  valorCredito?: number;
}

export interface PisCofinsEdit {
  cst?: string;
  baseCalculo?: number;
  aliquota?: number;
  valor?: number;
}

/** Impostos de uma linha como a pessoa os escreveu (na nota ou no contato). */
export interface LineTaxEdits {
  icms?: IcmsEdit;
  pis?: PisCofinsEdit;
  cofins?: PisCofinsEdit;
}

/** Onde a pessoa resolve o problema. */
export type TaxProblemOrigin = "nota" | "contato" | "emitente";

export interface TaxProblem {
  origem: TaxProblemOrigin;
  /** `icms.aliquota`, `pis.cst`... */
  campo: string;
  message: string;
}

export interface ResolveLineTaxesParams {
  regime: FiscalTaxRegime;
  natureza: NaturezaOperacao;
  /** Valor da linha (quantidade x unitário): a base padrão de tudo. */
  valorLinha: number;
  /** Para as mensagens. */
  descricao: string;
  /** Situação do ICMS cadastrada no produto, quando houver. */
  catalogSituacao?: string;
  edits?: LineTaxEdits;
  contato?: LineTaxEdits;
  /** Alíquota de crédito do Simples guardada nas configurações da empresa. */
  aliquotaCreditoSimples?: number;
}

export interface ResolvedLineTaxes {
  icms: FiscalIcms;
  pis: FiscalPisCofins;
  cofins: FiscalPisCofins;
  problemas: TaxProblem[];
}

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function pickSource<K extends keyof LineTaxEdits>(
  key: K,
  params: ResolveLineTaxesParams,
): { source?: LineTaxEdits[K]; origem: TaxProblemOrigin } {
  const nota = params.edits?.[key];
  if (nota) return { source: nota, origem: "nota" };
  const contato = isNaturezaTributada(params.natureza) ? params.contato?.[key] : undefined;
  if (contato) return { source: contato, origem: "contato" };
  return { origem: "nota" };
}

function resolveIcms(params: ResolveLineTaxesParams, problemas: TaxProblem[]): FiscalIcms {
  const kind = icmsKindForRegime(params.regime);
  const { source, origem } = pickSource("icms", params);
  const nomeCodigo = kind === "csosn" ? "CSOSN" : "CST";

  let situacao = deriveSituacaoTributariaOperacao(
    params.regime,
    params.natureza,
    params.catalogSituacao,
  ).codigo;
  const pedido = text(source?.situacao);
  if (pedido) {
    if (findIcmsSituacao(pedido)?.kind === kind) {
      situacao = pedido;
    } else {
      problemas.push({
        origem,
        campo: "icms.situacao",
        message:
          kind === "csosn"
            ? `O código ${pedido} não é um CSOSN aceito. No Simples Nacional a situação do ICMS é um CSOSN (101, 102, 900...).`
            : `O código ${pedido} não é um CST do ICMS aceito. No Regime Normal a situação do ICMS é um CST (00, 20, 90...).`,
      });
    }
  }

  const def = findIcmsSituacao(situacao);
  const icms: FiscalIcms = { kind, situacao };
  const destaque = def?.kind === kind ? def.destaque : "nenhum";
  const temValores =
    source?.aliquota !== undefined ||
    source?.baseCalculo !== undefined ||
    source?.valor !== undefined ||
    source?.reducaoBase !== undefined;

  if (destaque === "integral" || destaque === "reducao" || (destaque === "opcional" && temValores)) {
    if (source?.aliquota === undefined && destaque !== "opcional") {
      problemas.push({
        origem,
        campo: "icms.aliquota",
        message: `Informe a alíquota do ICMS de "${params.descricao}". O ${nomeCodigo} ${situacao} destaca o imposto.`,
      });
    }
    if (destaque === "reducao" && source?.reducaoBase === undefined) {
      problemas.push({
        origem,
        campo: "icms.reducaoBase",
        message: `Informe o percentual de redução da base do ICMS de "${params.descricao}" (CST 20).`,
      });
    }
    const reducao = source?.reducaoBase;
    const base = roundMoney(
      source?.baseCalculo ?? params.valorLinha * (1 - (reducao ?? 0) / 100),
    );
    const aliquota = source?.aliquota ?? 0;
    icms.baseCalculo = base;
    if (reducao !== undefined) icms.reducaoBase = reducao;
    icms.aliquota = aliquota;
    icms.valor = source?.valor !== undefined ? roundMoney(source.valor) : roundMoney((base * aliquota) / 100);
  }

  const credito = def?.kind === kind ? def.credito : "nenhum";
  if (credito !== "nenhum") {
    // No 900 o crédito só sai quando alguém o pediu: herdar a alíquota da
    // empresa poria a mensagem de crédito numa remessa.
    const aliquotaCredito =
      source?.aliquotaCredito ??
      (credito === "obrigatorio" ? params.aliquotaCreditoSimples : undefined);
    if (aliquotaCredito === undefined) {
      if (credito === "obrigatorio") {
        problemas.push({
          origem: "emitente",
          campo: "icms.aliquotaCredito",
          message:
            "Informe a alíquota do crédito de ICMS do Simples em Configurações, Nota fiscal (ou na própria linha). O CSOSN 101 exige o valor do crédito na nota.",
        });
      }
    } else {
      icms.aliquotaCredito = aliquotaCredito;
      icms.valorCredito =
        source?.valorCredito !== undefined
          ? roundMoney(source.valorCredito)
          : roundMoney((params.valorLinha * aliquotaCredito) / 100);
    }
  }

  return icms;
}

function resolvePisCofins(
  nome: "pis" | "cofins",
  params: ResolveLineTaxesParams,
  problemas: TaxProblem[],
): FiscalPisCofins {
  const rotulo = nome === "pis" ? "PIS" : "COFINS";
  const { source, origem } = pickSource(nome, params);

  let cst = derivePisCofinsCst(params.regime);
  const pedido = text(source?.cst);
  if (pedido) {
    if (findPisCofinsCst(pedido)) {
      cst = pedido;
    } else {
      problemas.push({
        origem,
        campo: `${nome}.cst`,
        message: `O CST ${pedido} do ${rotulo} não está entre os aceitos (01, 02, 04 a 09, 49 e 99).`,
      });
    }
  }

  const grupo = findPisCofinsCst(cst)?.grupo ?? "outros";
  if (grupo === "nao_tributado") return { cst };

  if (grupo === "aliquota" && source?.aliquota === undefined) {
    problemas.push({
      origem,
      campo: `${nome}.aliquota`,
      message: `Informe a alíquota do ${rotulo} de "${params.descricao}". O CST ${cst} destaca a contribuição.`,
    });
  }
  const aliquota = source?.aliquota ?? 0;
  const base = roundMoney(
    source?.baseCalculo ?? (grupo === "aliquota" || source?.aliquota !== undefined ? params.valorLinha : 0),
  );
  const valor =
    source?.valor !== undefined ? roundMoney(source.valor) : roundMoney((base * aliquota) / 100);
  return { cst, baseCalculo: base, aliquota, valor };
}

export function resolveLineTaxes(params: ResolveLineTaxesParams): ResolvedLineTaxes {
  const problemas: TaxProblem[] = [];
  const icms = resolveIcms(params, problemas);
  const pis = resolvePisCofins("pis", params, problemas);
  const cofins = resolvePisCofins("cofins", params, problemas);
  return { icms, pis, cofins, problemas };
}

const BRL = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PERCENT = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

/**
 * A mensagem que o art. 23 da LC 123/2006 manda constar quando a ME/EPP do
 * Simples transfere crédito de ICMS (CSOSN 101, ou 900 com crédito).
 *
 * Sem ela o destinatário não pode aproveitar o crédito, que é o motivo de ele
 * ter pedido o 101. Uma frase por alíquota: linhas com alíquotas diferentes não
 * se somam numa só.
 */
export function mensagensCreditoSimples(
  linhas: ReadonlyArray<{ icms: FiscalIcms }>,
): string[] {
  const porAliquota = new Map<number, number>();
  for (const { icms } of linhas) {
    if (icms.aliquotaCredito === undefined || !icms.valorCredito) continue;
    porAliquota.set(
      icms.aliquotaCredito,
      (porAliquota.get(icms.aliquotaCredito) ?? 0) + icms.valorCredito,
    );
  }
  return [...porAliquota.entries()]
    .sort(([a], [b]) => a - b)
    .map(
      ([aliquota, valor]) =>
        `Permite o aproveitamento do crédito de ICMS no valor de R$ ${BRL.format(roundMoney(valor))}, correspondente à alíquota de ${PERCENT.format(aliquota)}%, nos termos do art. 23 da LC 123/2006.`,
    );
}

export interface TaxTotals {
  baseIcms: number;
  valorIcms: number;
  valorCreditoIcms: number;
  valorPis: number;
  valorCofins: number;
}

/** Totais dos impostos destacados. Nenhum deles soma no total da nota. */
export function taxTotals(
  linhas: ReadonlyArray<{ icms: FiscalIcms; pis: FiscalPisCofins; cofins: FiscalPisCofins }>,
): TaxTotals {
  const sum = (pick: (linha: (typeof linhas)[number]) => number | undefined) =>
    roundMoney(linhas.reduce((total, linha) => total + (pick(linha) ?? 0), 0));
  return {
    baseIcms: sum((linha) => linha.icms.baseCalculo),
    valorIcms: sum((linha) => linha.icms.valor),
    valorCreditoIcms: sum((linha) => linha.icms.valorCredito),
    valorPis: sum((linha) => linha.pis.valor),
    valorCofins: sum((linha) => linha.cofins.valor),
  };
}
