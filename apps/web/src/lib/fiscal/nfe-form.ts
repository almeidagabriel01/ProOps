/**
 * Estado do formulário de emissão da NF-e e a tradução dele para a API.
 *
 * Puro, sem React: o formulário serve às duas origens (nota avulsa e nota da
 * proposta), e a montagem do corpo é onde um campo esquecido some sem erro.
 * O backend recalcula tudo na prévia; a conta do IPI aqui existe só para a
 * tela mostrar o número enquanto a prévia não volta.
 */

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

export interface ManualLineForm {
  /** Chave estável da linha na tela. */
  key: string;
  productId?: string;
  descricao: string;
  ncm: string;
  unidade: string;
  /** Texto do campo ("1", "1,5"): número controlado não deixa digitar a vírgula. */
  quantidade: string;
  valorUnitario: number;
  ipi: IpiForm;
  /**
   * Se a pessoa mexeu no IPI. Sem mexer, a linha não manda IPI nenhum e o
   * backend aplica o padrão do contato (que a prévia devolve para a tela).
   */
  ipiTouched: boolean;
}

/** Edição de uma linha da nota que nasce da proposta. */
export interface ProposalLineForm {
  index: number;
  productId: string;
  ipi: IpiForm;
  /** Se a pessoa mexeu no IPI desta linha (senão vale o que a prévia trouxe). */
  touched: boolean;
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
export function ipiFromApi(ipi?: { cst?: string; aliquota?: number; codigoEnquadramento?: string } | null): IpiForm {
  if (!ipi?.cst) return { ...EMPTY_IPI };
  return {
    cst: ipi.cst,
    aliquota: typeof ipi.aliquota === "number" ? String(ipi.aliquota).replace(".", ",") : "",
    codigoEnquadramento: ipi.codigoEnquadramento ?? "",
  };
}

/** Valor do IPI de uma linha, como o backend calcula (base = valor da linha). */
export function ipiValor(ipi: IpiForm, valorLinha: number): number {
  if (!IPI_CST_TRIBUTADOS.has(ipi.cst)) return 0;
  const aliquota = parseDecimal(ipi.aliquota) ?? 0;
  return Math.round(valorLinha * aliquota) / 100;
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
      descricao: linha.descricao.trim(),
      ncm: onlyDigits(linha.ncm),
      unidade: linha.unidade.trim().toUpperCase(),
      quantidade: parseDecimal(linha.quantidade) ?? 0,
      valorUnitario: linha.valorUnitario,
      ...(linha.ipiTouched ? { ipi: ipiToRequest(linha.ipi) } : {}),
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
    .filter((linha) => linha.touched)
    .map((linha) => ({ index: linha.index, productId: linha.productId, ipi: ipiToRequest(linha.ipi) }));
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
    ipi: { ...EMPTY_IPI },
    ipiTouched: false,
    ...partial,
  };
}
