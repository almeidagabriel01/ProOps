/**
 * Espelho de `apps/functions/src/api/services/fiscal/tax-codes.ts`: os códigos
 * de situação do ICMS (CSOSN e CST) e o CST do PIS e da COFINS que a nota
 * aceita editar, com o que cada um pede na tela.
 *
 * A lista é fechada pelo mesmo motivo do backend: código de substituição
 * tributária (CSOSN 201, CST 10...) exigiria um grupo que a nota não tem. A
 * paridade é cobrada por `src/__tests__/fiscal-tax-codes-parity.test.ts`.
 */

export type IcmsKind = "csosn" | "cst";
export type IcmsDestaque = "integral" | "reducao" | "opcional" | "nenhum";
export type IcmsCredito = "obrigatorio" | "opcional" | "nenhum";

export interface IcmsSituacaoDef {
  codigo: string;
  kind: IcmsKind;
  descricao: string;
  destaque: IcmsDestaque;
  credito: IcmsCredito;
}

export const ICMS_SITUACOES: readonly IcmsSituacaoDef[] = [
  { codigo: "101", kind: "csosn", descricao: "Tributada com permissão de crédito", destaque: "nenhum", credito: "obrigatorio" },
  { codigo: "102", kind: "csosn", descricao: "Tributada sem permissão de crédito", destaque: "nenhum", credito: "nenhum" },
  { codigo: "103", kind: "csosn", descricao: "Isenção do ICMS para a faixa de receita bruta", destaque: "nenhum", credito: "nenhum" },
  { codigo: "300", kind: "csosn", descricao: "Imune", destaque: "nenhum", credito: "nenhum" },
  { codigo: "400", kind: "csosn", descricao: "Não tributada", destaque: "nenhum", credito: "nenhum" },
  { codigo: "500", kind: "csosn", descricao: "ICMS cobrado antes por substituição tributária", destaque: "nenhum", credito: "nenhum" },
  { codigo: "900", kind: "csosn", descricao: "Outros", destaque: "opcional", credito: "opcional" },
  { codigo: "00", kind: "cst", descricao: "Tributada integralmente", destaque: "integral", credito: "nenhum" },
  { codigo: "20", kind: "cst", descricao: "Com redução da base de cálculo", destaque: "reducao", credito: "nenhum" },
  { codigo: "40", kind: "cst", descricao: "Isenta", destaque: "nenhum", credito: "nenhum" },
  { codigo: "41", kind: "cst", descricao: "Não tributada", destaque: "nenhum", credito: "nenhum" },
  { codigo: "50", kind: "cst", descricao: "Suspensão", destaque: "nenhum", credito: "nenhum" },
  { codigo: "51", kind: "cst", descricao: "Diferimento", destaque: "opcional", credito: "nenhum" },
  { codigo: "60", kind: "cst", descricao: "ICMS cobrado antes por substituição tributária", destaque: "nenhum", credito: "nenhum" },
  { codigo: "90", kind: "cst", descricao: "Outras", destaque: "opcional", credito: "nenhum" },
];

export type PisCofinsGrupo = "aliquota" | "nao_tributado" | "outros";

export interface PisCofinsCstDef {
  codigo: string;
  descricao: string;
  grupo: PisCofinsGrupo;
}

export const PIS_COFINS_CSTS: readonly PisCofinsCstDef[] = [
  { codigo: "01", descricao: "Tributável com alíquota básica", grupo: "aliquota" },
  { codigo: "02", descricao: "Tributável com alíquota diferenciada", grupo: "aliquota" },
  { codigo: "04", descricao: "Monofásica, revenda com alíquota zero", grupo: "nao_tributado" },
  { codigo: "05", descricao: "Substituição tributária", grupo: "nao_tributado" },
  { codigo: "06", descricao: "Alíquota zero", grupo: "nao_tributado" },
  { codigo: "07", descricao: "Isenta", grupo: "nao_tributado" },
  { codigo: "08", descricao: "Sem incidência", grupo: "nao_tributado" },
  { codigo: "09", descricao: "Com suspensão", grupo: "nao_tributado" },
  { codigo: "49", descricao: "Outras operações de saída", grupo: "outros" },
  { codigo: "99", descricao: "Outras operações", grupo: "outros" },
];

/** Simples (1), excesso de sublimite (2) e MEI (4) informam CSOSN. */
export function icmsKindForRegime(regime: number | undefined): IcmsKind {
  return regime === 1 || regime === 2 || regime === 4 ? "csosn" : "cst";
}

export function findIcmsSituacao(codigo: string | undefined): IcmsSituacaoDef | undefined {
  return ICMS_SITUACOES.find((item) => item.codigo === String(codigo ?? "").trim());
}

export function findPisCofinsCst(codigo: string | undefined): PisCofinsCstDef | undefined {
  return PIS_COFINS_CSTS.find((item) => item.codigo === String(codigo ?? "").trim());
}

/** "101: Tributada com permissão de crédito", para os seletores. */
export function codigoLabel(item: { codigo: string; descricao: string }): string {
  return `${item.codigo}: ${item.descricao}`;
}
