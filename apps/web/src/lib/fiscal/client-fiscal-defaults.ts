/**
 * Padrão fiscal do contato (`clients.fiscalDefaults`): observação e IPI que a
 * NF-e para ele já traz preenchidos.
 *
 * Nasceu de um cliente industrial que exige o IPI informado, e repetido na
 * observação, em toda nota que recebe. Guardado no contato, o caso é
 * resolvido uma vez; na emissão os dois continuam editáveis.
 *
 * Puro: as duas telas do contato (novo e edição) leem e gravam por aqui.
 */

import type { Client } from "@/services/client-service";
import { ipiFromApi, ipiToRequest } from "./nfe-form";

export interface FiscalDefaultsValues {
  observacoesNota: string;
  ipiCst: string;
  ipiAliquota: string;
  ipiEnquadramento: string;
}

export const EMPTY_FISCAL_DEFAULTS: FiscalDefaultsValues = {
  observacoesNota: "",
  ipiCst: "",
  ipiAliquota: "",
  ipiEnquadramento: "",
};

export function fiscalDefaultsFromClient(client: Pick<Client, "fiscalDefaults">): FiscalDefaultsValues {
  const ipi = ipiFromApi(client.fiscalDefaults?.ipi);
  return {
    observacoesNota: client.fiscalDefaults?.observacoes ?? "",
    ipiCst: ipi.cst,
    ipiAliquota: ipi.aliquota,
    ipiEnquadramento: ipi.codigoEnquadramento,
  };
}

/**
 * O corpo do cadastro. `null` apaga o padrão: é como a pessoa desfaz um IPI
 * que não vale mais para o contato.
 */
export function fiscalDefaultsToPayload(values: FiscalDefaultsValues): Client["fiscalDefaults"] | null {
  const observacoes = values.observacoesNota.trim();
  const ipi = ipiToRequest({
    cst: values.ipiCst,
    aliquota: values.ipiAliquota,
    codigoEnquadramento: values.ipiEnquadramento,
  });
  if (!observacoes && !ipi) return null;
  return {
    ...(observacoes ? { observacoes } : {}),
    ...(ipi ? { ipi } : {}),
  };
}

/** Resumo de uma linha para a ficha só de leitura. */
export function describeFiscalDefaults(values: FiscalDefaultsValues): string {
  const partes: string[] = [];
  if (values.ipiCst) {
    partes.push(
      values.ipiAliquota ? `IPI CST ${values.ipiCst}, ${values.ipiAliquota}%` : `IPI CST ${values.ipiCst}`,
    );
  }
  if (values.observacoesNota.trim()) partes.push(`Observação: ${values.observacoesNota.trim()}`);
  return partes.join("; ");
}
