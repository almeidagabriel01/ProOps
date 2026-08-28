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
  deriveSituacaoTributaria,
  deriveUnidadeComercial,
  describeNatureza,
  normalizeOrigem,
  type NaturezaOperacao,
} from "./natureza-operacao";
import type { FiscalSettingsDocument } from "./fiscal-settings.service";
import type {
  FiscalDocumentType,
  FiscalIeIndicator,
  FiscalInvoiceInput,
  FiscalProductItem,
  FiscalRecipient,
  FiscalServiceItem,
  FiscalTaxRegime,
} from "./fiscal-types";

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
}

interface CatalogItemDocument {
  ncm?: string;
  cest?: string;
  origem?: number;
  situacaoTributaria?: string;
  inventoryUnit?: string;
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

function buildProductItem(
  item: ProposalItem,
  catalog: CatalogItemDocument | undefined,
  regime: FiscalTaxRegime,
  cfop: string,
): FiscalProductItem {
  const quantidade = Number(item.quantity) || 1;
  const valorTotal = resolveLineTotal(item);
  const { kind, codigo } = deriveSituacaoTributaria(regime, catalog?.situacaoTributaria);

  return {
    codigo: item.productId,
    descricao: text(item.productName) || text(item.name) || "Item",
    ncm: text(catalog?.ncm).replace(/\D/g, ""),
    cest: text(catalog?.cest).replace(/\D/g, "") || undefined,
    cfop,
    origem: normalizeOrigem(catalog?.origem),
    unidadeComercial: deriveUnidadeComercial(catalog?.inventoryUnit),
    quantidade,
    // A SEFAZ valida quantidade × unitário contra o total da linha, então o
    // unitário é derivado do total e não o contrário.
    valorUnitario: quantidade > 0 ? valorTotal / quantidade : valorTotal,
    valorTotal,
    ...(kind === "csosn" ? { csosn: codigo } : { cstIcms: codigo }),
  };
}

/** Agrupa as linhas de serviço numa única NFS-e — o padrão do documento. */
function buildServiceItem(
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
    descricao: items
      .map((item) => text(item.productName) || text(item.name))
      .filter(Boolean)
      .join(" | "),
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
): Promise<Map<string, CatalogItemDocument>> {
  const ids = [...new Set(items.map((item) => item.productId).filter(Boolean))];
  const catalogs = new Map<string, CatalogItemDocument>();

  await Promise.all(
    ids.map(async (id) => {
      for (const collection of ["products", "services"]) {
        const snap = await db.collection(collection).doc(id).get();
        if (snap.exists) {
          catalogs.set(id, snap.data() as CatalogItemDocument);
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
  observacoes?: string;
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
    // CFOP depende da UF de destino, então falta de endereço vira lacuna
    // legível em vez de exceção — o readiness já cobre o campo.
    let cfop = "";
    try {
      cfop = deriveCfop(natureza, settings.endereco.uf, recipient.endereco?.uf ?? "");
    } catch {
      cfop = "";
    }

    const productItems = products.map((item) =>
      buildProductItem(item, catalogs.get(item.productId), settings.regimeTributario, cfop),
    );
    const valorTotal = productItems.reduce((sum, item) => sum + item.valorTotal, 0);

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
    gaps.push(...readiness.gaps);

    invoices.push({
      type: "nfe",
      valorTotal,
      input: {
        type: "nfe",
        ref: "",
        issuer: settings as never,
        recipient,
        products: productItems,
        naturezaOperacao: describeNatureza(natureza),
        observacoes: params.observacoes,
        dataEmissao,
        valorTotal,
      },
    });
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

  // Lacunas do emitente aparecem uma vez por documento — deduplicar evita uma
  // checklist com o mesmo item repetido.
  const seen = new Set<string>();
  const dedupedGaps = gaps.filter((gap) => {
    const key = `${gap.scope}:${gap.entityId ?? ""}:${gap.field}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    invoices,
    gaps: dedupedGaps,
    client: { id: client.id, nome: recipient.nome },
  };
}
