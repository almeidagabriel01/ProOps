/**
 * Estado do formulário de emissão da NF-e e a tradução dele para a API.
 *
 * Puro, sem React: o formulário serve às duas origens (nota avulsa e nota da
 * proposta), e a montagem do corpo é onde um campo esquecido some sem erro.
 * O backend recalcula tudo na prévia; a conta do IPI aqui existe só para a
 * tela mostrar o número enquanto a prévia não volta.
 */

import type {
  FiscalIcms,
  FiscalIpi,
  FiscalNfeLineView,
  FiscalPisCofins,
  FiscalSourceDocument,
  FiscalSourceItem,
} from "@/services/fiscal-service";
import type { ReceivedInvoice } from "@/services/received-invoice-service";
import { findIcmsSituacao, findPisCofinsCst, type IcmsKind } from "./tax-codes";

/** Página de emissão: nota avulsa, ou a revisão da nota de uma proposta. */
export function invoiceEditorPath(proposalId?: string): string {
  return proposalId
    ? `/invoices/new?proposal=${encodeURIComponent(proposalId)}`
    : "/invoices/new";
}

export type ModalidadeFrete = 0 | 1 | 2 | 3 | 4 | 9;

export const MODALIDADES_FRETE: Array<{ value: ModalidadeFrete; label: string }> = [
  { value: 9, label: "Sem frete" },
  { value: 0, label: "Por conta da minha empresa (CIF)" },
  { value: 1, label: "Por conta do destinatário (FOB)" },
  { value: 2, label: "Por conta de terceiros" },
  { value: 3, label: "Transporte próprio da minha empresa" },
  { value: 4, label: "Transporte próprio do destinatário" },
];

/** CST do IPI de saída, com o que cada um quer dizer para quem não é contador. */
export const IPI_CST_OPCOES: Array<{ value: string; label: string }> = [
  { value: "50", label: "50: saída tributada" },
  { value: "51", label: "51: tributada com alíquota zero" },
  { value: "52", label: "52: isenta" },
  { value: "53", label: "53: não tributada" },
  { value: "54", label: "54: imune" },
  { value: "55", label: "55: com suspensão" },
  { value: "99", label: "99: outras saídas" },
];

/** CST que levam base, alíquota e valor. */
export const IPI_CST_TRIBUTADOS = new Set(["50", "99"]);

export interface IpiForm {
  cst: string;
  /** Texto do campo, em percentual ("5" ou "5,5"). */
  aliquota: string;
  codigoEnquadramento: string;
}

export const EMPTY_IPI: IpiForm = { cst: "", aliquota: "", codigoEnquadramento: "" };

/**
 * ICMS da linha como a pessoa escreve. Os campos de valor (base, valor e
 * valor do crédito) em branco são CALCULADOS pelo backend: preenchê-los com o
 * número da prévia faria uma mudança de alíquota manter o valor antigo.
 */
export interface IcmsForm {
  situacao: string;
  reducaoBase: string;
  aliquota: string;
  aliquotaCredito: string;
  baseCalculo: string;
  valor: string;
  valorCredito: string;
}

/** PIS ou COFINS da linha. Base e valor em branco são calculados. */
export interface PisCofinsForm {
  cst: string;
  aliquota: string;
  baseCalculo: string;
  valor: string;
}

/**
 * Os impostos de uma linha. `null` = a pessoa não mexeu: vale o padrão do
 * contato, ou o da operação, e a tela mostra o que a prévia aplicou. Mexer num
 * imposto fixa só aquele imposto.
 */
export interface LineTaxesForm {
  icms: IcmsForm | null;
  /** `cst` vazio = tirar o IPI (o que vai à API como `null`). */
  ipi: IpiForm | null;
  pis: PisCofinsForm | null;
  cofins: PisCofinsForm | null;
}

export const UNTOUCHED_TAXES: LineTaxesForm = { icms: null, ipi: null, pis: null, cofins: null };

export interface ManualLineForm {
  /** Chave estável da linha na tela. */
  key: string;
  productId?: string;
  /** Código do item na nota de origem, quando veio de uma. */
  codigo?: string;
  descricao: string;
  ncm: string;
  cest?: string;
  origem?: number;
  unidade: string;
  /** Texto do campo ("1", "1,5"): número controlado não deixa digitar a vírgula. */
  quantidade: string;
  valorUnitario: number;
  impostos: LineTaxesForm;
}

/** Edição de uma linha da nota que nasce da proposta. */
export interface ProposalLineForm {
  index: number;
  productId: string;
  impostos: LineTaxesForm;
}

export interface TransporteForm {
  modalidadeFrete: ModalidadeFrete;
  transportadoraNome: string;
  transportadoraDocumento: string;
  transportadoraIe: string;
  transportadoraEndereco: string;
  transportadoraMunicipio: string;
  transportadoraUf: string;
  volumeQuantidade: string;
  volumeEspecie: string;
  pesoBruto: string;
  pesoLiquido: string;
}

export const EMPTY_TRANSPORTE: TransporteForm = {
  modalidadeFrete: 9,
  transportadoraNome: "",
  transportadoraDocumento: "",
  transportadoraIe: "",
  transportadoraEndereco: "",
  transportadoraMunicipio: "",
  transportadoraUf: "",
  volumeQuantidade: "",
  volumeEspecie: "",
  pesoBruto: "",
  pesoLiquido: "",
};

/** "5,5" e "5.5" valem o mesmo; vazio ou inválido é `undefined`. */
export function parseDecimal(value: string): number | undefined {
  const trimmed = value.trim();
  // "1.234,5" tem ponto de milhar; "5.5" tem ponto decimal.
  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** O que um campo decimal aceita enquanto a pessoa digita: dígitos, ponto e vírgula. */
export function decimalInput(value: string): string {
  return value.replace(/[^\d.,]/g, "");
}

/** Número para o campo de texto, com vírgula. */
export function decimalText(value: number | undefined): string {
  return value === undefined ? "" : String(value).replace(".", ",");
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** O IPI no formato da API. Sem CST, a linha vai sem IPI (`null`). */
export function ipiToRequest(ipi: IpiForm): { cst: string; aliquota?: number; codigoEnquadramento?: string } | null {
  if (!ipi.cst) return null;
  const aliquota = IPI_CST_TRIBUTADOS.has(ipi.cst) ? parseDecimal(ipi.aliquota) : undefined;
  const codigoEnquadramento = onlyDigits(ipi.codigoEnquadramento).slice(0, 3);
  return {
    cst: ipi.cst,
    ...(aliquota !== undefined ? { aliquota } : {}),
    ...(codigoEnquadramento ? { codigoEnquadramento } : {}),
  };
}

/** O contrário: o IPI que veio da prévia ou do cadastro, para o formulário. */
export function ipiFromApi(ipi?: Pick<FiscalIpi, "cst" | "aliquota" | "codigoEnquadramento"> | null): IpiForm {
  if (!ipi?.cst) return { ...EMPTY_IPI };
  return {
    cst: ipi.cst,
    aliquota: typeof ipi.aliquota === "number" ? decimalText(ipi.aliquota) : "",
    codigoEnquadramento: ipi.codigoEnquadramento ?? "",
  };
}

/** Valor do IPI de uma linha, como o backend calcula (base = valor da linha). */
export function ipiValor(ipi: IpiForm, valorLinha: number): number {
  if (!IPI_CST_TRIBUTADOS.has(ipi.cst)) return 0;
  const aliquota = parseDecimal(ipi.aliquota) ?? 0;
  return Math.round(valorLinha * aliquota) / 100;
}

/** Alíquota para começar a edição: zero da prévia é "não informado". */
function rateText(value: number | undefined): string {
  return value ? decimalText(value) : "";
}

/**
 * O ICMS que a prévia aplicou, como ponto de partida da edição. Só os campos
 * que a pessoa escolhe (código e percentuais): base e valor ficam em branco
 * para continuarem calculados.
 */
export function icmsFormFromView(icms?: FiscalIcms): IcmsForm {
  return {
    situacao: icms?.situacao ?? "",
    reducaoBase: rateText(icms?.reducaoBase),
    aliquota: rateText(icms?.aliquota),
    aliquotaCredito: rateText(icms?.aliquotaCredito),
    baseCalculo: "",
    valor: "",
    valorCredito: "",
  };
}

export function pisCofinsFormFromView(tax?: FiscalPisCofins): PisCofinsForm {
  return { cst: tax?.cst ?? "", aliquota: rateText(tax?.aliquota), baseCalculo: "", valor: "" };
}

/** Os quatro impostos, todos preenchidos: o que a tela mostra para editar. */
export interface EditableTaxes {
  icms: IcmsForm;
  ipi: IpiForm;
  pis: PisCofinsForm;
  cofins: PisCofinsForm;
}

/** Os quatro impostos da linha da prévia, para começar a editar. */
export function taxesFormFromView(line?: FiscalNfeLineView): EditableTaxes {
  return {
    icms: icmsFormFromView(line?.icms),
    ipi: ipiFromApi(line?.ipi),
    pis: pisCofinsFormFromView(line?.pis),
    cofins: pisCofinsFormFromView(line?.cofins),
  };
}

function numbers(source: Record<string, string>, keys: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of keys) {
    const value = parseDecimal(source[key] ?? "");
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/**
 * O ICMS no formato da API. Só os campos que o código aceita: um percentual
 * digitado e depois escondido pela troca de código não pode viajar junto.
 */
export function icmsToRequest(icms: IcmsForm): Record<string, unknown> {
  const def = findIcmsSituacao(icms.situacao);
  const campos = icms as unknown as Record<string, string>;
  return {
    ...(icms.situacao ? { situacao: icms.situacao } : {}),
    ...(def && def.destaque !== "nenhum"
      ? numbers(campos, ["reducaoBase", "aliquota", "baseCalculo", "valor"])
      : {}),
    ...(def && def.credito !== "nenhum" ? numbers(campos, ["aliquotaCredito", "valorCredito"]) : {}),
  };
}

export function pisCofinsToRequest(tax: PisCofinsForm): Record<string, unknown> {
  const def = findPisCofinsCst(tax.cst);
  return {
    cst: tax.cst,
    ...(def && def.grupo !== "nao_tributado"
      ? numbers(tax as unknown as Record<string, string>, ["aliquota", "baseCalculo", "valor"])
      : {}),
  };
}

export function hasTaxEdits(taxes: LineTaxesForm): boolean {
  return Boolean(taxes.icms || taxes.ipi || taxes.pis || taxes.cofins);
}

/** Só os impostos em que a pessoa mexeu; os outros seguem o padrão. */
export function taxesToRequest(taxes: LineTaxesForm): Record<string, unknown> {
  return {
    ...(taxes.icms?.situacao ? { icms: icmsToRequest(taxes.icms) } : {}),
    ...(taxes.ipi ? { ipi: ipiToRequest(taxes.ipi) } : {}),
    ...(taxes.pis?.cst ? { pis: pisCofinsToRequest(taxes.pis) } : {}),
    ...(taxes.cofins?.cst ? { cofins: pisCofinsToRequest(taxes.cofins) } : {}),
  };
}

export function transporteToRequest(t: TransporteForm): Record<string, unknown> | undefined {
  const volume: Record<string, unknown> = {};
  const quantidade = parseDecimal(t.volumeQuantidade);
  if (quantidade) volume.quantidade = Math.round(quantidade);
  if (t.volumeEspecie.trim()) volume.especie = t.volumeEspecie.trim();
  const pesoBruto = parseDecimal(t.pesoBruto);
  if (pesoBruto) volume.pesoBruto = pesoBruto;
  const pesoLiquido = parseDecimal(t.pesoLiquido);
  if (pesoLiquido) volume.pesoLiquido = pesoLiquido;

  const nome = t.transportadoraNome.trim();
  const out: Record<string, unknown> = { modalidadeFrete: t.modalidadeFrete };
  if (nome) {
    out.transportadora = {
      nome,
      documento: onlyDigits(t.transportadoraDocumento),
      inscricaoEstadual: t.transportadoraIe.trim(),
      endereco: t.transportadoraEndereco.trim(),
      municipio: t.transportadoraMunicipio.trim(),
      uf: t.transportadoraUf.trim().toUpperCase(),
    };
  }
  if (Object.keys(volume).length > 0) out.volumes = [volume];

  if (t.modalidadeFrete === 9 && !out.transportadora && !out.volumes) return undefined;
  return out;
}

/** Documento da transportadora: vazio, CPF ou CNPJ completos. */
export function transportadoraDocumentoValido(documento: string): boolean {
  const digits = onlyDigits(documento);
  return digits.length === 0 || digits.length === 11 || digits.length === 14;
}

/** Chaves digitadas, uma por linha; espaço e pontuação são ignorados. */
export function parseChaves(texto: string): { chaves: string[]; invalidas: string[] } {
  const partes = texto
    .split(/[\n;,]+/)
    .map((parte) => onlyDigits(parte))
    .filter(Boolean);
  return {
    chaves: [...new Set(partes.filter((parte) => parte.length === 44))],
    invalidas: partes.filter((parte) => parte.length !== 44),
  };
}

/** Acrescenta uma chave ao campo, sem repetir as que já estão lá. */
export function addChave(texto: string, chave: string): string {
  const atuais = parseChaves(texto).chaves;
  return atuais.includes(chave) ? atuais.join("\n") : [...atuais, chave].join("\n");
}

export interface NfeFormState {
  naturezaOperacao: string;
  /**
   * `null` = a pessoa não mexeu: vale a observação que o backend montar (a
   * padrão do contato), e a tela mostra a da prévia. Texto, inclusive vazio, é
   * o texto final.
   */
  observacoes: string | null;
  chavesTexto: string;
  transporte: TransporteForm;
}

/** O bloco `nfe` comum às duas origens. */
export function nfeEditsToRequest(
  state: NfeFormState,
  extra: { linhas?: Array<Record<string, unknown>> } = {},
): Record<string, unknown> {
  const transporte = transporteToRequest(state.transporte);
  return {
    ...(state.observacoes !== null ? { observacoes: state.observacoes } : {}),
    notasReferenciadas: parseChaves(state.chavesTexto).chaves,
    ...(transporte ? { transporte } : {}),
    ...(extra.linhas ? { linhas: extra.linhas } : {}),
  };
}

/** Corpo de `POST /v1/fiscal/invoices/manual` (e da prévia). */
export function manualRequest(
  clientId: string,
  state: NfeFormState,
  linhas: ManualLineForm[],
): Record<string, unknown> {
  return {
    clientId,
    naturezaOperacao: state.naturezaOperacao,
    linhas: linhas.map((linha) => ({
      ...(linha.productId ? { productId: linha.productId } : {}),
      ...(linha.codigo ? { codigo: linha.codigo } : {}),
      descricao: linha.descricao.trim(),
      ncm: onlyDigits(linha.ncm),
      ...(linha.cest ? { cest: onlyDigits(linha.cest) } : {}),
      ...(linha.origem !== undefined ? { origem: linha.origem } : {}),
      unidade: linha.unidade.trim().toUpperCase(),
      quantidade: parseDecimal(linha.quantidade) ?? 0,
      valorUnitario: linha.valorUnitario,
      ...taxesToRequest(linha.impostos),
    })),
    nfe: nfeEditsToRequest(state),
  };
}

/**
 * Corpo de `POST /v1/fiscal/invoices/from-proposal/:id` (e da prévia).
 *
 * Só as linhas em que a pessoa mexeu vão como edição: as outras seguem o que
 * o backend decidir (o padrão do contato), sem a tela fixar um valor velho.
 */
export function proposalRequest(
  state: NfeFormState,
  linhas: ProposalLineForm[],
): Record<string, unknown> {
  const editadas = linhas
    .filter((linha) => hasTaxEdits(linha.impostos))
    .map((linha) => ({ index: linha.index, productId: linha.productId, ...taxesToRequest(linha.impostos) }));
  return {
    naturezaOperacao: state.naturezaOperacao,
    nfe: nfeEditsToRequest(state, { linhas: editadas }),
  };
}

let lineSeq = 0;
export function newManualLine(partial: Partial<ManualLineForm> = {}): ManualLineForm {
  lineSeq += 1;
  return {
    key: `linha-${Date.now()}-${lineSeq}`,
    descricao: "",
    ncm: "",
    unidade: "UN",
    quantidade: "1",
    valorUnitario: 0,
    impostos: UNTOUCHED_TAXES,
    ...partial,
  };
}

/** Linha ainda em branco: importar uma nota a substitui em vez de somar. */
export function isBlankLine(line: ManualLineForm): boolean {
  return !line.descricao.trim() && !line.productId && !line.ncm.trim();
}

/**
 * Uma nota recebida (a lista que a tela de Notas já tem) no formato da nota
 * de origem. A recebida guarda só os itens, sem origem nem impostos.
 */
export function sourceFromReceived(invoice: ReceivedInvoice): FiscalSourceDocument {
  return {
    chave: invoice.chaveAcesso,
    ...(invoice.numero ? { numero: invoice.numero } : {}),
    ...(invoice.serie ? { serie: invoice.serie } : {}),
    ...(invoice.dataEmissao ? { dataEmissao: invoice.dataEmissao } : {}),
    emitente: { documento: invoice.emitenteCnpj, nome: invoice.emitenteNome ?? "" },
    valorTotal: invoice.valorTotal,
    relacao: "recebida",
    itens: (invoice.itens ?? []).map((item) => ({
      numero: item.numero,
      codigo: item.codigo ?? "",
      descricao: item.descricao,
      ncm: item.ncm ?? "",
      cfop: item.cfop ?? "",
      unidade: (item.unidade ?? "UN").toUpperCase().slice(0, 6),
      quantidade: item.quantidade,
      valorUnitario: item.valorUnitario,
      valorTotal: item.valorTotal,
    })),
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * O ICMS da devolução espelha o da compra: o fornecedor estorna o crédito que
 * tomou, então a nota leva a mesma alíquota sobre a base PROPORCIONAL à
 * quantidade devolvida. Sai como "outros" (900 no Simples, 90 no Normal), que
 * é o código que aceita destacar. Sem ICMS destacado na origem, nada a copiar.
 */
function devolucaoIcms(item: FiscalSourceItem, quantidade: number, icmsKind: IcmsKind): IcmsForm | null {
  const origem = item.icms;
  if (!origem?.aliquota || origem.baseCalculo === undefined || item.quantidade <= 0) return null;
  return {
    situacao: icmsKind === "csosn" ? "900" : "90",
    reducaoBase: "",
    aliquota: decimalText(origem.aliquota),
    aliquotaCredito: "",
    baseCalculo: decimalText(roundMoney((origem.baseCalculo * quantidade) / item.quantidade)),
    valor: "",
    valorCredito: "",
  };
}

/**
 * Os itens escolhidos da nota de origem, como linhas da nota avulsa. A
 * quantidade é a escolhida (a nota tem 5, mando 1); o valor unitário, o da
 * origem.
 */
export function linesFromSource(
  doc: FiscalSourceDocument,
  escolhidos: Array<{ numero: number; quantidade: number }>,
  options: { devolucao: boolean; icmsKind: IcmsKind },
): ManualLineForm[] {
  return escolhidos.flatMap(({ numero, quantidade }) => {
    const item = doc.itens.find((candidato) => candidato.numero === numero);
    if (!item || quantidade <= 0) return [];
    const icms = options.devolucao ? devolucaoIcms(item, quantidade, options.icmsKind) : null;
    return [
      newManualLine({
        ...(item.codigo ? { codigo: item.codigo } : {}),
        descricao: item.descricao,
        ncm: item.ncm,
        ...(item.cest ? { cest: item.cest } : {}),
        ...(item.origem !== undefined ? { origem: item.origem } : {}),
        unidade: item.unidade || "UN",
        quantidade: decimalText(quantidade),
        valorUnitario: item.valorUnitario,
        impostos: icms ? { ...UNTOUCHED_TAXES, icms } : UNTOUCHED_TAXES,
      }),
    ];
  });
}
