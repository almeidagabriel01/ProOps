/**
 * Monta a nota fiscal a partir dos dados que já existem no ERP.
 *
 * É aqui que a proposta mista do nicho vira documento fiscal. Uma venda de
 * cortina motorizada **com** instalação pode gerar **duas notas**: NF-e da
 * mercadoria (ICMS) e NFS-e da mão de obra (ISS). O discriminante já existe no
 * modelo — `ProposalProduct.itemType` — e nunca é adivinhado aqui.
 *
 * O enquadramento em si continua sendo decisão do contador do cliente: o que
 * este módulo faz é *permitir* as duas notas, nunca decidir que elas são
 * devidas. Fornecendo o material sem característica de obra civil, a operação
 * fica só no ICMS; havendo projeto e integração ao imóvel (LC 116 item 7.02),
 * saem as duas.
 */

import { db } from "../../../init";
import { logger } from "../../../lib/logger";
import { checkIssueReadiness, type FiscalGap } from "./fiscal-readiness";
import { toBrasiliaIso } from "./fiscal-datetime";
import {
  DEFAULT_NATUREZA,
  deriveCfop,
  deriveUnidadeComercial,
  describeNatureza,
  naturezaFinalidade,
  naturezaReferencia,
  normalizeOrigem,
  type NaturezaOperacao,
} from "./natureza-operacao";
import {
  parseIcmsEdit,
  parseIpi,
  parsePisCofinsEdit,
  resolveIpi,
  totalIpi,
} from "./nfe-extras";
import {
  mensagensCreditoSimples,
  resolveLineTaxes,
  taxTotals,
  type LineTaxEdits,
  type TaxProblem,
} from "./line-taxes";
import { icmsKindForRegime, type IcmsKind } from "./tax-codes";
import type { FiscalSettingsDocument } from "./fiscal-settings.service";
import type {
  FiscalDocumentType,
  FiscalIcms,
  FiscalIeIndicator,
  FiscalInvoiceInput,
  FiscalIpi,
  FiscalPisCofins,
  FiscalProductItem,
  FiscalRecipient,
  FiscalServiceItem,
  FiscalTaxRegime,
  FiscalTransporte,
} from "./fiscal-types";

/**
 * Padrão fiscal guardado no contato (`clients.fiscalDefaults`).
 *
 * Nasceu de um cliente industrial que exige o IPI informado, e repetido na
 * observação, em toda nota que recebe; depois veio o cliente que compra com
 * crédito de ICMS (CSOSN 101). Guardar no contato resolve uma vez: a nota para
 * ele já nasce assim, e continua editável na emissão. Vale só para a NF-e.
 *
 * ICMS, PIS e COFINS do contato valem só nas operações tributadas (a venda):
 * numa remessa para conserto o CSOSN de venda dele não descreve a nota. O IPI e
 * a observação valem sempre, porque o cliente os exige em toda nota.
 */
export interface ClientFiscalDefaults extends LineTaxEdits {
  observacoes?: string;
  ipi?: FiscalIpi;
}

interface ClientDocument {
  id: string;
  tenantId: string;
  name?: string;
  email?: string;
  phone?: string;
  document?: string;
  inscricaoEstadual?: string;
  indicadorIe?: FiscalIeIndicator;
  consumidorFinal?: boolean;
  enderecoFiscal?: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    municipio?: string;
    codigoIbge?: string;
    uf?: string;
    cep?: string;
  };
  /** Lido como veio do banco; `clientDefaults` valida. */
  fiscalDefaults?: Record<string, unknown>;
}

export interface CatalogItemDocument {
  ncm?: string;
  cest?: string;
  origem?: number;
  situacaoTributaria?: string;
  inventoryUnit?: string;
  /** Modo de preço do produto; `curtain_meter` cobra por m². */
  pricingModel?: { mode?: string };
  codigoLc116?: string;
  codigoTributacaoMunicipio?: string;
  aliquotaIss?: number;
  issRetido?: boolean;
  nbs?: string;
  codigoTributacaoNacional?: string;
}

export interface ProposalItem {
  productId: string;
  productName?: string;
  name?: string;
  itemType?: "product" | "service";
  quantity?: number;
  unitPrice?: number;
  markup?: number;
  total?: number;
  productDescription?: string;
  status?: string;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Deriva o indicador de IE quando o cadastro não o traz.
 *
 * Pessoa física nunca é "isento" — é "não contribuinte". Confundir os dois é
 * exatamente a rejeição 805, a mais comum do mercado.
 */
export function deriveIndicadorIe(
  documento: string,
  stored: FiscalIeIndicator | undefined,
): FiscalIeIndicator {
  if (stored) return stored;
  const digits = documento.replace(/\D/g, "");
  return digits.length === 14 ? "nao_contribuinte" : "nao_contribuinte";
}

function buildRecipient(client: ClientDocument): FiscalRecipient {
  const documento = text(client.document).replace(/\D/g, "");
  const endereco = client.enderecoFiscal;

  return {
    documento,
    nome: text(client.name),
    email: text(client.email) || undefined,
    telefone: text(client.phone) || undefined,
    inscricaoEstadual: text(client.inscricaoEstadual) || undefined,
    indicadorIe: deriveIndicadorIe(documento, client.indicadorIe),
    // Instalador vende para consumidor final na esmagadora maioria dos casos.
    consumidorFinal: client.consumidorFinal !== false,
    ...(endereco
      ? {
          endereco: {
            logradouro: text(endereco.logradouro),
            numero: text(endereco.numero),
            complemento: text(endereco.complemento),
            bairro: text(endereco.bairro),
            municipio: text(endereco.municipio),
            codigoIbge: text(endereco.codigoIbge).replace(/\D/g, ""),
            uf: text(endereco.uf).toUpperCase(),
            cep: text(endereco.cep).replace(/\D/g, ""),
          },
        }
      : {}),
  };
}

/**
 * Preço de venda efetivo da linha.
 *
 * `unitPrice` no catálogo é o preço BASE; a venda é base × (1 + markup/100).
 * Enviar o preço base para a SEFAZ subfaturaria a nota — por isso `total`,
 * quando presente, tem prioridade: ele já é o valor negociado.
 */
export function resolveLineTotal(item: ProposalItem): number {
  const total = Number(item.total);
  if (Number.isFinite(total) && total > 0) return total;

  const quantity = Number(item.quantity) || 0;
  const unitPrice = Number(item.unitPrice) || 0;
  const markup = Number(item.markup) || 0;
  return quantity * unitPrice * (1 + markup / 100);
}

/** O que a linha precisa saber da nota para calcular os impostos. */
export interface LineTaxContext {
  regime: FiscalTaxRegime;
  natureza?: NaturezaOperacao;
  /** Padrão fiscal do contato (já validado). */
  contato?: ClientFiscalDefaults;
  /** Alíquota de crédito do Simples das configurações da empresa. */
  aliquotaCreditoSimples?: number;
}

export interface BuiltProductLine {
  item: FiscalProductItem;
  /** O que falta para os impostos da linha; vira lacuna em `taxGaps`. */
  problemas: TaxProblem[];
}

/** Completa uma linha com ICMS, PIS e COFINS (`line-taxes.ts`). */
function withTaxes(
  base: Omit<FiscalProductItem, "icms" | "pis" | "cofins">,
  context: LineTaxContext,
  catalogSituacao: string | undefined,
  impostos: LineTaxEdits | undefined,
): BuiltProductLine {
  const { icms, pis, cofins, problemas } = resolveLineTaxes({
    regime: context.regime,
    natureza: context.natureza ?? DEFAULT_NATUREZA,
    valorLinha: base.valorTotal,
    descricao: base.descricao,
    catalogSituacao,
    edits: impostos,
    contato: context.contato,
    aliquotaCreditoSimples: context.aliquotaCreditoSimples,
  });
  return { item: { ...base, icms, pis, cofins }, problemas };
}

export function buildProductItem(
  item: ProposalItem,
  catalog: CatalogItemDocument | undefined,
  context: LineTaxContext,
  cfop: string,
  options: {
    /** Impostos escritos na própria nota (vencem o padrão do contato). */
    impostos?: LineTaxEdits;
    ipi?: FiscalIpi;
  } = {},
): BuiltProductLine {
  const quantidade = Number(item.quantity) || 1;
  const valorTotal = resolveLineTotal(item);

  return withTaxes(
    {
      ...(options.ipi ? { ipi: options.ipi } : {}),
      codigo: item.productId,
      descricao: text(item.productName) || text(item.name) || "Item",
      ncm: text(catalog?.ncm).replace(/\D/g, ""),
      cest: text(catalog?.cest).replace(/\D/g, "") || undefined,
      cfop,
      origem: normalizeOrigem(catalog?.origem),
      unidadeComercial: deriveUnidadeComercial(
        catalog?.inventoryUnit,
        catalog?.pricingModel?.mode,
      ),
      quantidade,
      // A SEFAZ valida quantidade × unitário contra o total da linha, então o
      // unitário é derivado do total e não o contrário.
      valorUnitario: quantidade > 0 ? valorTotal / quantidade : valorTotal,
      valorTotal,
    },
    context,
    catalog?.situacaoTributaria,
    options.impostos,
  );
}

/**
 * Lacunas dos impostos de uma linha, cada uma no lugar onde se corrige: a
 * linha da nota, o cadastro do contato ou as configurações da empresa.
 */
function taxGaps(
  problemas: TaxProblem[],
  linha: { index: number; descricao: string },
  client: ClientDocument,
): FiscalGap[] {
  return problemas.map((problema): FiscalGap => {
    if (problema.origem === "contato") {
      return {
        scope: "cliente",
        entityId: client.id,
        entityName: text(client.name),
        field: `fiscalDefaults.${problema.campo}`,
        message: `${problema.message} O valor vem do padrão fiscal do contato.`,
      };
    }
    if (problema.origem === "emitente") {
      return { scope: "emitente", field: "aliquotaCreditoIcmsSimples", message: problema.message };
    }
    return {
      scope: "nota",
      entityName: linha.descricao,
      field: `linhas.${linha.index}.${problema.campo}`,
      message: problema.message,
    };
  });
}

/** Agrupa as linhas de serviço numa única NFS-e — o padrão do documento. */
export function buildServiceItem(
  items: ProposalItem[],
  catalogs: Map<string, CatalogItemDocument>,
): FiscalServiceItem {
  const valorServicos = items.reduce((sum, item) => sum + resolveLineTotal(item), 0);
  // O enquadramento vem do primeiro serviço com código cadastrado; itens sem
  // código são pegos pelo gate de readiness antes de qualquer envio.
  const primary = items
    .map((item) => catalogs.get(item.productId))
    .find((catalog) => text(catalog?.codigoLc116));

  return {
    // Sem repetição: a mesma linha de serviço costuma aparecer em mais de um
    // ambiente da proposta, e a nota saía com "Instalação | Instalação" na
    // descrição que o cliente final lê.
    descricao: [
      ...new Set(
        items
          .map((item) => text(item.productName) || text(item.name))
          .filter(Boolean),
      ),
    ].join(" | "),
    codigoLc116: text(primary?.codigoLc116),
    codigoTributacaoMunicipio: text(primary?.codigoTributacaoMunicipio) || undefined,
    valorServicos,
    aliquotaIss: Number(primary?.aliquotaIss) || 0,
    issRetido: primary?.issRetido === true,
    nbs: text(primary?.nbs) || undefined,
    codigoTributacaoNacional: text(primary?.codigoTributacaoNacional) || undefined,
  };
}

async function loadClient(tenantId: string, clientId: string): Promise<ClientDocument> {
  const snap = await db.collection("clients").doc(clientId).get();
  if (!snap.exists) {
    throw new Error("CLIENTE_NAO_ENCONTRADO");
  }
  const data = snap.data() as ClientDocument;
  if (data.tenantId !== tenantId) {
    throw new Error("FORBIDDEN_TENANT_MISMATCH");
  }
  return { ...data, id: clientId };
}

/**
 * Carrega os campos fiscais dos itens do catálogo.
 * Um item ausente vira `undefined` — a lacuna aparece no gate de readiness com
 * o nome do produto, em vez de estourar aqui sem contexto.
 */
async function loadCatalog(
  items: ProposalItem[],
  /**
   * Na nota avulsa o id vem do corpo da requisição, não de uma proposta da
   * empresa: sem esta conferência, um id de outra empresa traria o NCM dela.
   */
  tenantId?: string,
): Promise<Map<string, CatalogItemDocument>> {
  const ids = [...new Set(items.map((item) => item.productId).filter(Boolean))];
  const catalogs = new Map<string, CatalogItemDocument>();

  await Promise.all(
    ids.map(async (id) => {
      for (const collection of ["products", "services"]) {
        const snap = await db.collection(collection).doc(id).get();
        if (snap.exists) {
          const data = snap.data() as CatalogItemDocument & { tenantId?: string };
          if (tenantId && data.tenantId !== tenantId) return;
          catalogs.set(id, data);
          return;
        }
      }
    }),
  );

  return catalogs;
}

export interface AssembledInvoice {
  type: FiscalDocumentType;
  input: FiscalInvoiceInput;
  valorTotal: number;
}

export interface AssemblyResult {
  /** Uma entrada por documento a emitir — duas numa venda mista. */
  invoices: AssembledInvoice[];
  gaps: FiscalGap[];
  client: { id: string; nome: string };
}

/**
 * Edição de uma linha de mercadoria da nota que nasce da proposta.
 *
 * Os valores da linha são os da venda e não mudam aqui: a nota de uma venda
 * tem que bater com a venda. O que a pessoa ajusta é o que a proposta não
 * sabe: os impostos (ICMS, IPI, PIS e COFINS). Imposto ausente = não mexeu,
 * vale o padrão do contato ou o da operação.
 */
export interface NfeLineEdit extends LineTaxEdits {
  /** Posição entre as linhas de MERCADORIA ativas da proposta. */
  index: number;
  /** Confere que a linha é a mesma que a tela mostrou. */
  productId: string;
  /** `null` tira o IPI que viria do padrão do contato. */
  ipi?: FiscalIpi | null;
}

/** O que o formulário de emissão muda na NF-e. Tudo opcional. */
export interface NfeEdits {
  /** Texto FINAL das informações complementares (substitui o padrão). */
  observacoes?: string;
  notasReferenciadas?: string[];
  transporte?: FiscalTransporte;
  linhas?: NfeLineEdit[];
}

/**
 * Uma linha da nota avulsa: do catálogo (`productId`), digitada, ou trazida
 * de uma nota de origem (`codigo` é o código do item lá).
 */
export interface ManualNfeLine extends LineTaxEdits {
  productId?: string;
  /** Código do item; padrão: o `productId`, ou `AVULSO-n`. */
  codigo?: string;
  descricao: string;
  /** Vence o NCM do catálogo; obrigatório na linha digitada. */
  ncm?: string;
  cest?: string;
  origem?: number;
  /** `UN`, `KG`, `M`... Padrão: o do catálogo, ou `UN`. */
  unidade?: string;
  quantidade: number;
  valorUnitario: number;
  ipi?: FiscalIpi | null;
}

/**
 * Junta a observação padrão do contato com a que veio do documento de origem.
 *
 * O texto do formulário (`NfeEdits.observacoes`) não passa por aqui: ele já é
 * o texto final, mostrado com o padrão preenchido.
 */
function mergeObservacoes(...parts: Array<string | undefined>): string | undefined {
  const joined = parts.map((part) => text(part)).filter(Boolean).join(" | ");
  return joined || undefined;
}

/**
 * O padrão fiscal do contato, já validado.
 *
 * A gravação passa pelo schema de `clients.controller.ts`, então dado ruim aqui
 * só vem de escrita fora da API: é ignorado, imposto a imposto, em vez de
 * derrubar a nota inteira.
 */
function clientDefaults(client: ClientDocument): ClientFiscalDefaults {
  const raw = client.fiscalDefaults;
  if (!raw) return {};
  const safe = <T>(parse: () => T | undefined): T | undefined => {
    try {
      return parse();
    } catch {
      return undefined;
    }
  };
  // Valores da nota (base, valor, crédito em reais) não são padrão de contato.
  const icms = safe(() => parseIcmsEdit(raw.icms));
  const pis = safe(() => parsePisCofinsEdit(raw.pis));
  const cofins = safe(() => parsePisCofinsEdit(raw.cofins));
  const defaults: ClientFiscalDefaults = {};
  const observacoes = text(raw.observacoes);
  if (observacoes) defaults.observacoes = observacoes;
  const ipi = safe(() => parseIpi(raw.ipi));
  if (ipi) defaults.ipi = ipi;
  if (icms) {
    defaults.icms = {
      ...(icms.situacao ? { situacao: icms.situacao } : {}),
      ...(icms.reducaoBase !== undefined ? { reducaoBase: icms.reducaoBase } : {}),
      ...(icms.aliquota !== undefined ? { aliquota: icms.aliquota } : {}),
      ...(icms.aliquotaCredito !== undefined ? { aliquotaCredito: icms.aliquotaCredito } : {}),
    };
  }
  if (pis) defaults.pis = { cst: pis.cst, ...(pis.aliquota !== undefined ? { aliquota: pis.aliquota } : {}) };
  if (cofins) defaults.cofins = { cst: cofins.cst, ...(cofins.aliquota !== undefined ? { aliquota: cofins.aliquota } : {}) };
  return defaults;
}

/**
 * Lacunas da NOTA, não do cadastro: a devolução sem a chave da nota devolvida
 * é recusada pela SEFAZ, então o formulário a cobra antes de enviar.
 */
function noteGaps(natureza: NaturezaOperacao, notasReferenciadas: string[]): FiscalGap[] {
  if (naturezaReferencia(natureza) === "obrigatoria" && notasReferenciadas.length === 0) {
    return [
      {
        scope: "nota",
        field: "notasReferenciadas",
        message:
          "Informe a chave de acesso da nota que está sendo devolvida. A SEFAZ recusa a devolução sem ela.",
      },
    ];
  }
  return [];
}

/**
 * Monta a NF-e a partir de linhas já resolvidas.
 *
 * Ponto único das duas origens (proposta e nota avulsa): total com IPI,
 * finalidade, referência e as mensagens legais que os impostos das linhas
 * pedem. Assim a nota avulsa não vira uma segunda implementação da regra.
 */
function buildNfe(params: {
  settings: FiscalSettingsDocument;
  recipient: FiscalRecipient;
  natureza: NaturezaOperacao;
  products: FiscalProductItem[];
  observacoes?: string;
  notasReferenciadas: string[];
  transporte?: FiscalTransporte;
  dataEmissao: string;
}): AssembledInvoice {
  const valorProdutos = params.products.reduce((sum, item) => sum + item.valorTotal, 0);
  const valorTotal = Math.round((valorProdutos + totalIpi(params.products)) * 100) / 100;
  const mensagensLegais = mensagensCreditoSimples(params.products);
  return {
    type: "nfe",
    valorTotal,
    input: {
      type: "nfe",
      ref: "",
      issuer: params.settings as never,
      recipient: params.recipient,
      products: params.products,
      naturezaOperacao: describeNatureza(params.natureza),
      observacoes: params.observacoes,
      ...(mensagensLegais.length > 0 ? { mensagensLegais } : {}),
      dataEmissao: params.dataEmissao,
      valorTotal,
      finalidade: naturezaFinalidade(params.natureza),
      ...(params.notasReferenciadas.length > 0
        ? { notasReferenciadas: params.notasReferenciadas }
        : {}),
      ...(params.transporte ? { transporte: params.transporte } : {}),
    },
  };
}

/**
 * Lacunas do emitente e do contato aparecem uma vez por documento ou por
 * linha: deduplicar evita uma checklist com o mesmo item repetido.
 */
function dedupeGaps(gaps: FiscalGap[]): FiscalGap[] {
  const seen = new Set<string>();
  return gaps.filter((gap) => {
    const key = `${gap.scope}:${gap.entityId ?? ""}:${gap.field}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cfopFor(settings: FiscalSettingsDocument, natureza: NaturezaOperacao, recipient: FiscalRecipient): string {
  // CFOP depende da UF de destino, então falta de endereço vira lacuna
  // legível em vez de exceção — o readiness já cobre o campo.
  try {
    return deriveCfop(natureza, settings.endereco.uf, recipient.endereco?.uf ?? "");
  } catch {
    return "";
  }
}

/** Linha da NF-e como a tela de emissão mostra (sem dado do emitente). */
export interface NfeLineView {
  productId?: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  icms: FiscalIcms;
  pis: FiscalPisCofins;
  cofins: FiscalPisCofins;
  ipi?: FiscalIpi;
  ipiValor: number;
}

/** O que a tela precisa para revisar a NF-e antes de enviar. */
export interface NfeView {
  /** CSOSN (Simples) ou CST (Regime Normal): decide a lista do seletor. */
  icmsKind: IcmsKind;
  naturezaOperacao: string;
  finalidade: "normal" | "devolucao";
  observacoes: string;
  /** Textos que a lei manda constar; a tela mostra, mas não edita. */
  mensagensLegais: string[];
  notasReferenciadas: string[];
  transporte?: FiscalTransporte;
  valorProdutos: number;
  valorIpi: number;
  /** Destacados na nota; nenhum soma no total. */
  baseIcms: number;
  valorIcms: number;
  valorCreditoIcms: number;
  valorPis: number;
  valorCofins: number;
  valorTotal: number;
  linhas: NfeLineView[];
}

export function describeNfe(input: FiscalInvoiceInput): NfeView {
  const products = input.products ?? [];
  const linhas = products.map((item) => ({
    productId: item.codigo || undefined,
    descricao: item.descricao,
    ncm: item.ncm,
    cfop: item.cfop,
    unidade: item.unidadeComercial,
    quantidade: item.quantidade,
    valorUnitario: Math.round(item.valorUnitario * 100) / 100,
    valorTotal: Math.round(item.valorTotal * 100) / 100,
    icms: item.icms,
    pis: item.pis,
    cofins: item.cofins,
    ...(item.ipi ? { ipi: item.ipi } : {}),
    ipiValor: item.ipi ? resolveIpi(item.ipi, item.valorTotal).valor ?? 0 : 0,
  }));
  const valorProdutos = Math.round(products.reduce((sum, item) => sum + item.valorTotal, 0) * 100) / 100;
  return {
    icmsKind: icmsKindForRegime(input.issuer.regimeTributario),
    naturezaOperacao: input.naturezaOperacao ?? "",
    finalidade: input.finalidade ?? "normal",
    observacoes: input.observacoes ?? "",
    mensagensLegais: input.mensagensLegais ?? [],
    notasReferenciadas: input.notasReferenciadas ?? [],
    ...(input.transporte ? { transporte: input.transporte } : {}),
    valorProdutos,
    valorIpi: totalIpi(products),
    ...taxTotals(products),
    valorTotal: input.valorTotal,
    linhas,
  };
}

/**
 * Monta os documentos fiscais de um conjunto de itens.
 *
 * Separa por `itemType` e devolve **uma nota por tipo habilitado**. As lacunas
 * de todos os documentos são acumuladas juntas: o usuário vê uma checklist só,
 * em vez de corrigir a NF-e, tentar de novo e só então descobrir a NFS-e.
 */
export async function assembleInvoices(params: {
  tenantId: string;
  settings: FiscalSettingsDocument;
  clientId: string;
  items: ProposalItem[];
  naturezaOperacao?: NaturezaOperacao;
  /** Texto do documento de origem; soma-se à observação padrão do contato. */
  observacoes?: string;
  /** Edições do formulário de emissão, só na NF-e. */
  nfe?: NfeEdits;
  transactionId?: string;
  proposalId?: string;
}): Promise<AssemblyResult> {
  const { settings, items } = params;

  const client = await loadClient(params.tenantId, params.clientId);
  const activeItems = items.filter((item) => item.status !== "inactive");
  const catalogs = await loadCatalog(activeItems);

  const recipient = buildRecipient(client);
  const natureza = params.naturezaOperacao ?? DEFAULT_NATUREZA;
  // Fuso de Brasília, não UTC: o Ambiente Nacional compara o relógio de parede
  // e rejeitou a primeira nota real com E0008 por causa disso.
  const dataEmissao = toBrasiliaIso();

  const products = activeItems.filter((item) => item.itemType !== "service");
  const services = activeItems.filter((item) => item.itemType === "service");

  const invoices: AssembledInvoice[] = [];
  const gaps: FiscalGap[] = [];

  if (products.length > 0 && settings.habilitaNfe) {
    const cfop = cfopFor(settings, natureza, recipient);
    const defaults = clientDefaults(client);
    const edits = params.nfe ?? {};

    const editsByIndex = new Map((edits.linhas ?? []).map((edit) => [edit.index, edit]));
    for (const edit of editsByIndex.values()) {
      // A proposta mudou entre a tela abrir e o envio: aplicar a edição na
      // linha errada poria o IPI de um produto em outro.
      if (products[edit.index]?.productId !== edit.productId) {
        throw new Error("NOTA_DESATUALIZADA");
      }
    }

    const context: LineTaxContext = {
      regime: settings.regimeTributario,
      natureza,
      contato: defaults,
      aliquotaCreditoSimples: settings.aliquotaCreditoIcmsSimples,
    };
    const lineGaps: FiscalGap[] = [];
    const productItems = products.map((item, index) => {
      const edit = editsByIndex.get(index);
      const ipi = edit && edit.ipi !== undefined ? edit.ipi ?? undefined : defaults.ipi;
      const built = buildProductItem(item, catalogs.get(item.productId), context, cfop, {
        impostos: edit,
        ipi,
      });
      lineGaps.push(...taxGaps(built.problemas, { index, descricao: built.item.descricao }, client));
      return built.item;
    });

    const notasReferenciadas = edits.notasReferenciadas ?? [];
    const readiness = checkIssueReadiness({
      type: "nfe",
      issuer: settings,
      recipient: { ...recipient, id: client.id, nome: recipient.nome },
      products: productItems.map((item, index) => ({
        id: products[index].productId,
        name: item.descricao,
        ncm: item.ncm,
      })),
    });
    gaps.push(...readiness.gaps, ...lineGaps, ...noteGaps(natureza, notasReferenciadas));

    invoices.push(
      buildNfe({
        settings,
        recipient,
        natureza,
        products: productItems,
        observacoes:
          edits.observacoes !== undefined
            ? text(edits.observacoes) || undefined
            : mergeObservacoes(defaults.observacoes, params.observacoes),
        notasReferenciadas,
        transporte: edits.transporte,
        dataEmissao,
      }),
    );
  }

  if (services.length > 0 && settings.habilitaNfse) {
    const service = buildServiceItem(services, catalogs);

    const readiness = checkIssueReadiness({
      type: "nfse",
      issuer: settings,
      recipient: { ...recipient, id: client.id, nome: recipient.nome },
      service: {
        id: services[0].productId,
        name: service.descricao,
        codigoLc116: service.codigoLc116,
        aliquotaIss: service.aliquotaIss,
        codigoTributacaoNacional: service.codigoTributacaoNacional,
      },
      padraoNfse: settings.padraoNfse,
    });
    gaps.push(...readiness.gaps);

    invoices.push({
      type: "nfse",
      valorTotal: service.valorServicos,
      input: {
        type: "nfse",
        ref: "",
        issuer: settings as never,
        recipient,
        service,
        observacoes: params.observacoes,
        dataEmissao,
        valorTotal: service.valorServicos,
      },
    });
  }

  if (invoices.length === 0) {
    logger.warn("Nenhum documento fiscal a emitir", {
      tenantId: params.tenantId,
      produtos: products.length,
      servicos: services.length,
      habilitaNfe: settings.habilitaNfe,
      habilitaNfse: settings.habilitaNfse,
    });
  }

  return {
    invoices,
    gaps: dedupeGaps(gaps),
    client: { id: client.id, nome: recipient.nome },
  };
}

/**
 * Monta a NF-e AVULSA: sem proposta, com as linhas digitadas na hora.
 *
 * É o caminho das notas sem venda (remessa para conserto, devolução de compra,
 * retorno, demonstração). Quem emite essas notas digita na hora o que está
 * mandando, sem puxar o XML da entrada, então a linha aceita tanto um produto
 * do catálogo (de onde vêm NCM, unidade e origem) quanto um item só digitado.
 *
 * Mesmas regras da venda, pelo mesmo `buildNfe`: CFOP pela operação e pelas
 * UFs, ICMS pela operação, IPI e observação padrão do contato.
 */
export async function assembleManualNfe(params: {
  tenantId: string;
  settings: FiscalSettingsDocument;
  clientId: string;
  naturezaOperacao: NaturezaOperacao;
  linhas: ManualNfeLine[];
  nfe?: Omit<NfeEdits, "linhas">;
}): Promise<AssemblyResult> {
  const { settings } = params;
  const client = await loadClient(params.tenantId, params.clientId);
  const recipient = buildRecipient(client);
  const natureza = params.naturezaOperacao;
  const defaults = clientDefaults(client);
  const edits = params.nfe ?? {};
  const cfop = cfopFor(settings, natureza, recipient);

  const catalogIds = params.linhas
    .map((linha) => linha.productId)
    .filter((id): id is string => Boolean(id));
  const catalogs = await loadCatalog(catalogIds.map((productId) => ({ productId })), params.tenantId);

  const context: LineTaxContext = {
    regime: settings.regimeTributario,
    natureza,
    contato: defaults,
    aliquotaCreditoSimples: settings.aliquotaCreditoIcmsSimples,
  };

  const gaps: FiscalGap[] = [];
  const products: FiscalProductItem[] = params.linhas.map((linha, index) => {
    const catalog = linha.productId ? catalogs.get(linha.productId) : undefined;
    const descricao = text(linha.descricao) || `Item ${index + 1}`;
    const quantidade = Number(linha.quantidade) || 0;
    const valorUnitario = Number(linha.valorUnitario) || 0;
    const ncm = (text(linha.ncm) || text(catalog?.ncm)).replace(/\D/g, "");

    if (ncm.length !== 8) {
      gaps.push({
        scope: "nota",
        field: `linhas.${index}.ncm`,
        entityName: descricao,
        message: `Informe o NCM de "${descricao}" (8 dígitos). Ele costuma vir na nota de compra.`,
      });
    }
    if (quantidade <= 0 || valorUnitario <= 0) {
      gaps.push({
        scope: "nota",
        field: `linhas.${index}.valor`,
        entityName: descricao,
        message: `Informe a quantidade e o valor unitário de "${descricao}". A SEFAZ não aceita item zerado.`,
      });
    }

    const ipi = linha.ipi !== undefined ? linha.ipi ?? undefined : defaults.ipi;
    const unidade =
      text(linha.unidade).toUpperCase().slice(0, 6) ||
      deriveUnidadeComercial(catalog?.inventoryUnit, catalog?.pricingModel?.mode);

    const built = withTaxes(
      {
        codigo: text(linha.codigo) || linha.productId || `AVULSO-${index + 1}`,
        descricao,
        ncm,
        cest: (text(linha.cest) || text(catalog?.cest)).replace(/\D/g, "") || undefined,
        cfop,
        origem: normalizeOrigem(linha.origem ?? catalog?.origem),
        unidadeComercial: unidade,
        quantidade,
        valorUnitario,
        valorTotal: Math.round(quantidade * valorUnitario * 100) / 100,
        ...(ipi ? { ipi } : {}),
      },
      context,
      catalog?.situacaoTributaria,
      linha,
    );
    gaps.push(...taxGaps(built.problemas, { index, descricao }, client));
    return built.item;
  });

  const notasReferenciadas = edits.notasReferenciadas ?? [];
  // NCM e item zerado já foram cobrados linha a linha, no escopo da nota;
  // aqui entram só emitente e cliente (lista de produtos vazia não gera
  // lacuna de NCM, só a de "ao menos um item" quando não há linha nenhuma).
  const readiness = checkIssueReadiness({
    type: "nfe",
    issuer: settings,
    recipient: { ...recipient, id: client.id, nome: recipient.nome },
    products: products.map((item) => ({ name: item.descricao, ncm: "00000000" })),
  });
  gaps.unshift(...readiness.gaps.filter((gap) => gap.field !== "items"));
  if (products.length === 0) {
    gaps.push({ scope: "nota", field: "linhas", message: "Acrescente ao menos um item à nota." });
  }
  gaps.push(...noteGaps(natureza, notasReferenciadas));

  const invoice = buildNfe({
    settings,
    recipient,
    natureza,
    products,
    observacoes:
      edits.observacoes !== undefined ? text(edits.observacoes) || undefined : defaults.observacoes,
    notasReferenciadas,
    transporte: edits.transporte,
    dataEmissao: toBrasiliaIso(),
  });

  return {
    invoices: settings.habilitaNfe && products.length > 0 ? [invoice] : [],
    gaps: dedupeGaps(gaps),
    client: { id: client.id, nome: recipient.nome },
  };
}
