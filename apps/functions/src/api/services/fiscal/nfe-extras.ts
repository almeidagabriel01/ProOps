/**
 * O que a NF-e leva além dos itens: IPI e os demais impostos editáveis por
 * linha, transporte e notas referenciadas.
 *
 * Tudo aqui é opcional e nada é derivado do catálogo. Até a nota avulsa, a
 * emissão mandava sempre "sem frete", sem IPI e sem referência, e quem
 * precisava de qualquer um dos três (remessa com transportadora, devolução,
 * cliente industrial que exige o IPI) não tinha como emitir pelo ERP.
 *
 * As funções `parse*` são a fronteira com o corpo da requisição: aceitam
 * `unknown`, descartam o que não for válido e lançam só quando o dado veio e
 * está errado de um jeito que a SEFAZ recusaria.
 */

import {
  IPI_CST_SAIDA,
  IPI_CST_TRIBUTADOS,
  type FiscalIpi,
  type FiscalModalidadeFrete,
  type FiscalTransporte,
  type FiscalVolume,
} from "./fiscal-types";
import type { IcmsEdit, LineTaxEdits, PisCofinsEdit } from "./line-taxes";
import { findIcmsSituacao, findPisCofinsCst } from "./tax-codes";

/** `cEnq` quando não há enquadramento específico (valor da própria norma). */
export const IPI_ENQUADRAMENTO_PADRAO = "999";

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function finiteNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function text(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export interface ResolvedIpi {
  cst: string;
  codigoEnquadramento: string;
  /** Presentes só nos CST tributados. */
  baseCalculo?: number;
  aliquota?: number;
  valor?: number;
}

/**
 * Completa o IPI de uma linha: base = valor da linha, valor = base × alíquota.
 *
 * Valor digitado vence o calculado (a nota do fornecedor pode ter arredondado
 * diferente, e a pessoa está copiando dela). CST não tributado sai sem base,
 * alíquota e valor: o grupo `IPINT` não tem esses campos.
 */
export function resolveIpi(ipi: FiscalIpi, valorLinha: number): ResolvedIpi {
  const cst = String(ipi.cst || "").trim();
  const codigoEnquadramento =
    String(ipi.codigoEnquadramento || "").replace(/\D/g, "") || IPI_ENQUADRAMENTO_PADRAO;

  if (!IPI_CST_TRIBUTADOS.has(cst)) {
    return { cst, codigoEnquadramento };
  }

  const baseCalculo = roundMoney(ipi.baseCalculo ?? valorLinha);
  const aliquota = Number(ipi.aliquota) || 0;
  const valor =
    typeof ipi.valor === "number" && Number.isFinite(ipi.valor)
      ? roundMoney(ipi.valor)
      : roundMoney((baseCalculo * aliquota) / 100);

  return { cst, codigoEnquadramento, baseCalculo, aliquota, valor };
}

/** Soma do IPI destacado nas linhas: entra no total da nota. */
export function totalIpi(
  linhas: ReadonlyArray<{ ipi?: FiscalIpi; valorTotal: number }>,
): number {
  return roundMoney(
    linhas.reduce(
      (sum, linha) => sum + (linha.ipi ? resolveIpi(linha.ipi, linha.valorTotal).valor ?? 0 : 0),
      0,
    ),
  );
}

/**
 * IPI vindo da tela ou do cadastro do contato.
 *
 * `null` e `undefined` significam coisas diferentes para quem chama (tirar o
 * IPI x não mexer), então esta função só trata o objeto; a distinção fica com
 * o chamador.
 *
 * @throws `IPI_CST_INVALIDO` quando o CST não é um código de saída.
 */
export function parseIpi(value: unknown): FiscalIpi | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const cst = text(raw.cst, 2);
  if (!cst) return undefined;
  if (!(IPI_CST_SAIDA as readonly string[]).includes(cst)) {
    throw new Error("IPI_CST_INVALIDO");
  }
  const aliquota = finiteNumber(raw.aliquota);
  if (aliquota !== undefined && (aliquota < 0 || aliquota > 100)) {
    throw new Error("IPI_ALIQUOTA_INVALIDA");
  }
  const ipi: FiscalIpi = { cst };
  if (aliquota !== undefined) ipi.aliquota = aliquota;
  const baseCalculo = finiteNumber(raw.baseCalculo);
  if (baseCalculo !== undefined && baseCalculo >= 0) ipi.baseCalculo = baseCalculo;
  const valor = finiteNumber(raw.valor);
  if (valor !== undefined && valor >= 0) ipi.valor = valor;
  const enquadramento = text(raw.codigoEnquadramento, 3).replace(/\D/g, "");
  if (enquadramento) ipi.codigoEnquadramento = enquadramento;
  return ipi;
}

/** Percentual entre 0 e 100; fora disso a SEFAZ recusa. */
function percentual(value: unknown, erro: string): number | undefined {
  const parsed = finiteNumber(value);
  if (parsed === undefined) return undefined;
  if (parsed < 0 || parsed > 100) throw new Error(erro);
  return parsed;
}

function valorMonetario(value: unknown, erro: string): number | undefined {
  const parsed = finiteNumber(value);
  if (parsed === undefined) return undefined;
  if (parsed < 0) throw new Error(erro);
  return parsed;
}

/**
 * ICMS de uma linha vindo da tela ou do cadastro do contato.
 *
 * O código precisa estar na lista de `tax-codes.ts`; se ele é do regime da
 * empresa (CSOSN ou CST) é conferido no cálculo, que conhece o regime.
 * Objeto sem nada aproveitável vira `undefined` (= não mexeu).
 *
 * @throws `ICMS_SITUACAO_INVALIDA`, `ICMS_ALIQUOTA_INVALIDA`, `ICMS_VALOR_INVALIDO`.
 */
export function parseIcmsEdit(value: unknown): IcmsEdit | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const edit: IcmsEdit = {};
  const situacao = text(raw.situacao, 3).replace(/\D/g, "");
  if (situacao) {
    if (!findIcmsSituacao(situacao)) throw new Error("ICMS_SITUACAO_INVALIDA");
    edit.situacao = situacao;
  }
  const percentuais = ["reducaoBase", "aliquota", "aliquotaCredito"] as const;
  for (const key of percentuais) {
    const parsed = percentual(raw[key], "ICMS_ALIQUOTA_INVALIDA");
    if (parsed !== undefined) edit[key] = parsed;
  }
  const valores = ["baseCalculo", "valor", "valorCredito"] as const;
  for (const key of valores) {
    const parsed = valorMonetario(raw[key], "ICMS_VALOR_INVALIDO");
    if (parsed !== undefined) edit[key] = parsed;
  }
  return Object.keys(edit).length > 0 ? edit : undefined;
}

/**
 * PIS ou COFINS de uma linha. Sem CST não há o que aplicar: `undefined`.
 *
 * @throws `PIS_COFINS_CST_INVALIDO`, `PIS_COFINS_ALIQUOTA_INVALIDA`,
 * `PIS_COFINS_VALOR_INVALIDO`.
 */
export function parsePisCofinsEdit(value: unknown): PisCofinsEdit | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const cst = text(raw.cst, 2).replace(/\D/g, "");
  if (!cst) return undefined;
  if (!findPisCofinsCst(cst)) throw new Error("PIS_COFINS_CST_INVALIDO");
  const edit: PisCofinsEdit = { cst };
  const aliquota = percentual(raw.aliquota, "PIS_COFINS_ALIQUOTA_INVALIDA");
  if (aliquota !== undefined) edit.aliquota = aliquota;
  const baseCalculo = valorMonetario(raw.baseCalculo, "PIS_COFINS_VALOR_INVALIDO");
  if (baseCalculo !== undefined) edit.baseCalculo = baseCalculo;
  const valor = valorMonetario(raw.valor, "PIS_COFINS_VALOR_INVALIDO");
  if (valor !== undefined) edit.valor = valor;
  return edit;
}

/** Os três impostos editáveis de uma linha (o IPI tem o seu, `parseIpi`). */
export function parseLineTaxEdits(raw: Record<string, unknown>): LineTaxEdits {
  const edits: LineTaxEdits = {};
  const icms = parseIcmsEdit(raw.icms);
  if (icms) edits.icms = icms;
  const pis = parsePisCofinsEdit(raw.pis);
  if (pis) edits.pis = pis;
  const cofins = parsePisCofinsEdit(raw.cofins);
  if (cofins) edits.cofins = cofins;
  return edits;
}

const MODALIDADES: readonly FiscalModalidadeFrete[] = [0, 1, 2, 3, 4, 9];

/**
 * Transporte vindo da tela. "Sem frete" sem mais nada vira `undefined`, que é
 * o que a nota já mandava antes.
 *
 * @throws `TRANSPORTADORA_DOCUMENTO_INVALIDO` com CPF/CNPJ de tamanho errado.
 */
export function parseTransporte(value: unknown): FiscalTransporte | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const modalidade = Number(raw.modalidadeFrete);
  const modalidadeFrete = (MODALIDADES as readonly number[]).includes(modalidade)
    ? (modalidade as FiscalModalidadeFrete)
    : 9;

  const transporte: FiscalTransporte = { modalidadeFrete };

  const rawCarrier = raw.transportadora as Record<string, unknown> | undefined;
  const nome = text(rawCarrier?.nome, 60);
  if (nome) {
    const documento = text(rawCarrier?.documento, 20).replace(/\D/g, "");
    if (documento && documento.length !== 11 && documento.length !== 14) {
      throw new Error("TRANSPORTADORA_DOCUMENTO_INVALIDO");
    }
    transporte.transportadora = {
      nome,
      ...(documento ? { documento } : {}),
      ...(text(rawCarrier?.inscricaoEstadual, 20)
        ? { inscricaoEstadual: text(rawCarrier?.inscricaoEstadual, 20) }
        : {}),
      ...(text(rawCarrier?.endereco, 60) ? { endereco: text(rawCarrier?.endereco, 60) } : {}),
      ...(text(rawCarrier?.municipio, 60) ? { municipio: text(rawCarrier?.municipio, 60) } : {}),
      ...(text(rawCarrier?.uf, 2) ? { uf: text(rawCarrier?.uf, 2).toUpperCase() } : {}),
    };
  }

  const volumes = (Array.isArray(raw.volumes) ? raw.volumes : [])
    .slice(0, 20)
    .map((item): FiscalVolume | null => {
      if (!item || typeof item !== "object") return null;
      const vol = item as Record<string, unknown>;
      const volume: FiscalVolume = {};
      const quantidade = finiteNumber(vol.quantidade);
      if (quantidade !== undefined && quantidade > 0) volume.quantidade = Math.round(quantidade);
      const pesoBruto = finiteNumber(vol.pesoBruto);
      if (pesoBruto !== undefined && pesoBruto > 0) volume.pesoBruto = pesoBruto;
      const pesoLiquido = finiteNumber(vol.pesoLiquido);
      if (pesoLiquido !== undefined && pesoLiquido > 0) volume.pesoLiquido = pesoLiquido;
      if (text(vol.especie, 60)) volume.especie = text(vol.especie, 60);
      if (text(vol.marca, 60)) volume.marca = text(vol.marca, 60);
      if (text(vol.numeracao, 60)) volume.numeracao = text(vol.numeracao, 60);
      return Object.keys(volume).length > 0 ? volume : null;
    })
    .filter((volume): volume is FiscalVolume => volume !== null);
  if (volumes.length > 0) transporte.volumes = volumes;

  if (modalidadeFrete === 9 && !transporte.transportadora && !transporte.volumes) {
    return undefined;
  }
  return transporte;
}

/**
 * Chaves de acesso das notas referenciadas: 44 dígitos, sem repetição.
 *
 * @throws `CHAVE_REFERENCIADA_INVALIDA` quando alguma não tem 44 dígitos. Uma
 * chave cortada passaria daqui e voltaria da SEFAZ como rejeição, depois de
 * consumir número da série.
 */
export function parseNotasReferenciadas(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [];
  const chaves = list
    .map((item) => (typeof item === "string" ? item.replace(/\D/g, "") : ""))
    .filter(Boolean);
  for (const chave of chaves) {
    if (chave.length !== 44) throw new Error("CHAVE_REFERENCIADA_INVALIDA");
  }
  return [...new Set(chaves)].slice(0, 50);
}
