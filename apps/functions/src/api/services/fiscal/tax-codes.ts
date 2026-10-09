/**
 * Códigos de situação tributária que a NF-e aceita editar por linha: ICMS
 * (CSOSN no Simples, CST no Regime Normal), PIS e COFINS.
 *
 * Puro, sem import: o front espelha esta lista para montar os seletores, com
 * paridade testada (`apps/web/src/__tests__/fiscal-tax-codes-parity.test.ts`).
 *
 * A lista é FECHADA de propósito. Ela traz só os códigos que o ERP sabe
 * preencher por inteiro: um CSOSN 201 ou um CST 10 exigem o grupo da
 * substituição tributária (MVA, base e valor do ST), que a nota não tem onde
 * declarar, e ofereceriam à pessoa uma escolha que a SEFAZ recusaria. Código
 * fora da lista que venha do catálogo do produto (o campo antigo
 * `situacaoTributaria`) continua passando só com o código, como sempre passou.
 */

export type IcmsKind = "csosn" | "cst";

/**
 * Como o ICMS próprio aparece na linha.
 *
 *  - `integral`: base, alíquota e valor obrigatórios (CST 00).
 *  - `reducao`: idem, com o percentual de redução da base (CST 20).
 *  - `opcional`: o grupo aceita base, alíquota e valor, sem exigir (CST 51 e
 *    90, CSOSN 900). Sem alíquota, sai só o código.
 *  - `nenhum`: o grupo não tem esses campos.
 */
export type IcmsDestaque = "integral" | "reducao" | "opcional" | "nenhum";

/**
 * Crédito de ICMS do Simples (`pCredSN` e `vCredICMSSN`, art. 23 da LC
 * 123/2006): obrigatório no CSOSN 101 e opcional no 900.
 */
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

/**
 * Grupo de PIS e COFINS no XML, decidido pelo CST.
 *
 *  - `aliquota`: base, alíquota e valor obrigatórios (CST 01 e 02).
 *  - `nao_tributado`: só o código (04 a 09).
 *  - `outros`: base, alíquota e valor, que podem ser zero (49 e 99).
 */
export type PisCofinsGrupo = "aliquota" | "nao_tributado" | "outros";

export interface PisCofinsCstDef {
  codigo: string;
  descricao: string;
  grupo: PisCofinsGrupo;
}

/** O mesmo código vale para PIS e COFINS: a tabela é uma só. */
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
export function icmsKindForRegime(regime: number): IcmsKind {
  return regime === 1 || regime === 2 || regime === 4 ? "csosn" : "cst";
}

export function findIcmsSituacao(codigo: string | undefined): IcmsSituacaoDef | undefined {
  const value = String(codigo ?? "").trim();
  return ICMS_SITUACOES.find((item) => item.codigo === value);
}

export function findPisCofinsCst(codigo: string | undefined): PisCofinsCstDef | undefined {
  const value = String(codigo ?? "").trim();
  return PIS_COFINS_CSTS.find((item) => item.codigo === value);
}
