/**
 * Padrão fiscal do contato (`clients.fiscalDefaults`): observação e impostos
 * que a NF-e para ele já traz preenchidos.
 *
 * Nasceu de um cliente industrial que exige o IPI informado, e repetido na
 * observação, em toda nota que recebe; depois veio o cliente que compra com
 * crédito de ICMS (CSOSN 101). Guardado no contato, o caso é resolvido uma
 * vez; na emissão tudo continua editável. ICMS, PIS e COFINS daqui valem só
 * na venda (uma remessa para conserto não herda o CSOSN de venda).
 *
 * Puro: as duas telas do contato (novo e edição) leem e gravam por aqui.
 */

import type { Client } from "@/services/client-service";
import { decimalText, ipiFromApi, ipiToRequest, parseDecimal } from "./nfe-form";
import { findIcmsSituacao, findPisCofinsCst } from "./tax-codes";

export interface FiscalDefaultsValues {
  observacoesNota: string;
  ipiCst: string;
  ipiAliquota: string;
  ipiEnquadramento: string;
  /** CSOSN (Simples) ou CST (Regime Normal). Vazio = o padrão da operação. */
  icmsSituacao: string;
  icmsReducaoBase: string;
  icmsAliquota: string;
  /** Vazio = a alíquota das configurações fiscais da empresa. */
  icmsAliquotaCredito: string;
  pisCst: string;
  pisAliquota: string;
  cofinsCst: string;
  cofinsAliquota: string;
}

export const EMPTY_FISCAL_DEFAULTS: FiscalDefaultsValues = {
  observacoesNota: "",
  ipiCst: "",
  ipiAliquota: "",
  ipiEnquadramento: "",
  icmsSituacao: "",
  icmsReducaoBase: "",
  icmsAliquota: "",
  icmsAliquotaCredito: "",
  pisCst: "",
  pisAliquota: "",
  cofinsCst: "",
  cofinsAliquota: "",
};

export function fiscalDefaultsFromClient(client: Pick<Client, "fiscalDefaults">): FiscalDefaultsValues {
  const defaults = client.fiscalDefaults;
  const ipi = ipiFromApi(defaults?.ipi);
  return {
    observacoesNota: defaults?.observacoes ?? "",
    ipiCst: ipi.cst,
    ipiAliquota: ipi.aliquota,
    ipiEnquadramento: ipi.codigoEnquadramento,
    icmsSituacao: defaults?.icms?.situacao ?? "",
    icmsReducaoBase: decimalText(defaults?.icms?.reducaoBase),
    icmsAliquota: decimalText(defaults?.icms?.aliquota),
    icmsAliquotaCredito: decimalText(defaults?.icms?.aliquotaCredito),
    pisCst: defaults?.pis?.cst ?? "",
    pisAliquota: decimalText(defaults?.pis?.aliquota),
    cofinsCst: defaults?.cofins?.cst ?? "",
    cofinsAliquota: decimalText(defaults?.cofins?.aliquota),
  };
}

function optional(key: string, value: string): Record<string, number> {
  const parsed = parseDecimal(value);
  return parsed === undefined ? {} : { [key]: parsed };
}

type FiscalDefaults = NonNullable<Client["fiscalDefaults"]>;

/** O ICMS do contato, só com os campos que o código aceita. */
function icmsPayload(values: FiscalDefaultsValues): FiscalDefaults["icms"] | undefined {
  const def = findIcmsSituacao(values.icmsSituacao);
  if (!def) return undefined;
  return {
    situacao: def.codigo,
    ...(def.destaque !== "nenhum"
      ? { ...optional("reducaoBase", values.icmsReducaoBase), ...optional("aliquota", values.icmsAliquota) }
      : {}),
    ...(def.credito !== "nenhum" ? optional("aliquotaCredito", values.icmsAliquotaCredito) : {}),
  };
}

function pisCofinsPayload(cst: string, aliquota: string): { cst: string; aliquota?: number } | undefined {
  const def = findPisCofinsCst(cst);
  if (!def) return undefined;
  return { cst: def.codigo, ...(def.grupo !== "nao_tributado" ? optional("aliquota", aliquota) : {}) };
}

/**
 * O corpo do cadastro. `null` apaga o padrão: é como a pessoa desfaz um
 * padrão que não vale mais para o contato.
 */
export function fiscalDefaultsToPayload(values: FiscalDefaultsValues): Client["fiscalDefaults"] | null {
  const observacoes = values.observacoesNota.trim();
  const ipi = ipiToRequest({
    cst: values.ipiCst,
    aliquota: values.ipiAliquota,
    codigoEnquadramento: values.ipiEnquadramento,
  });
  const icms = icmsPayload(values);
  const pis = pisCofinsPayload(values.pisCst, values.pisAliquota);
  const cofins = pisCofinsPayload(values.cofinsCst, values.cofinsAliquota);
  if (!observacoes && !ipi && !icms && !pis && !cofins) return null;
  return {
    ...(observacoes ? { observacoes } : {}),
    ...(ipi ? { ipi } : {}),
    ...(icms ? { icms } : {}),
    ...(pis ? { pis } : {}),
    ...(cofins ? { cofins } : {}),
  };
}

/** Resumo de uma linha para a ficha só de leitura. */
export function describeFiscalDefaults(values: FiscalDefaultsValues): string {
  const partes: string[] = [];
  const icms = findIcmsSituacao(values.icmsSituacao);
  if (icms) {
    const tipo = icms.kind === "csosn" ? "CSOSN" : "CST";
    const credito = icms.credito !== "nenhum" && values.icmsAliquotaCredito ? `, crédito de ${values.icmsAliquotaCredito}%` : "";
    partes.push(`ICMS ${tipo} ${icms.codigo}${credito}`);
  }
  if (values.ipiCst) {
    partes.push(
      values.ipiAliquota ? `IPI CST ${values.ipiCst}, ${values.ipiAliquota}%` : `IPI CST ${values.ipiCst}`,
    );
  }
  for (const [rotulo, cst, aliquota] of [
    ["PIS", values.pisCst, values.pisAliquota],
    ["COFINS", values.cofinsCst, values.cofinsAliquota],
  ] as const) {
    if (cst) partes.push(aliquota ? `${rotulo} CST ${cst}, ${aliquota}%` : `${rotulo} CST ${cst}`);
  }
  if (values.observacoesNota.trim()) partes.push(`Observação: ${values.observacoesNota.trim()}`);
  return partes.join("; ");
}
