/**
 * Emissão a partir de um documento de negócio.
 *
 * A nota nunca nasce de um formulário em branco — nasce de uma proposta ganha
 * ou de um lançamento. Foi o padrão que o benchmark mostrou em todos os ERPs
 * consolidados, e é o que evita o usuário redigitar o que o sistema já sabe.
 *
 * Estas funções são o ponto único de emissão: os botões da UI e os gatilhos
 * automáticos chamam exatamente as mesmas, então não existe caminho automático
 * que pule uma validação que o manual faz.
 */

import { db } from "../../../init";
import { logger } from "../../../lib/logger";
import { getFiscalSettings } from "./fiscal-settings.service";
import {
  assembleInvoices,
  type AssemblyResult,
  type ProposalItem,
} from "./invoice-assembly.service";
import {
  createInvoice,
  issueInvoice,
  listInvoicesByProposal,
  type InvoiceDocument,
} from "./invoice.service";
import type { FiscalGap } from "./fiscal-readiness";
import {
  assertInvoiceQuota,
  getInvoiceQuota,
  remainingInvoices,
  type InvoiceQuota,
} from "./invoice-quota.service";
import { resolveTenantCapabilities } from "../../../lib/tenant-capabilities";
import type { NaturezaOperacao } from "./natureza-operacao";
import type { FiscalDocumentType, FiscalInvoiceStatus } from "./fiscal-types";

export interface IssueFromSourceResult {
  /** Documentos efetivamente enviados — dois numa venda mista. */
  invoices: InvoiceDocument[];
  /** Preenchido quando nada foi enviado por falta de dado fiscal. */
  gaps: FiscalGap[];
}

interface ProposalDocument {
  tenantId?: string;
  clientId?: string;
  products?: ProposalItem[];
  closedValue?: number | null;
  totalValue?: number;
  title?: string;
}

interface TransactionDocument {
  tenantId?: string;
  clientId?: string;
  proposalId?: string;
  description?: string;
}

/**
 * Emite os documentos fiscais de uma proposta.
 *
 * Uma proposta mista gera **duas notas** — NF-e da mercadoria e NFS-e da mão de
 * obra —, separadas por `itemType`. Se faltar qualquer dado fiscal, **nada é
 * enviado**: emitir metade de uma venda mista deixaria o cliente com um
 * documento fiscal parcial e o outro pendente.
 */
export async function issueFromProposal(
  tenantId: string,
  proposalId: string,
  options: {
    createdBy?: string;
    naturezaOperacao?: NaturezaOperacao;
    observacoes?: string;
    transactionId?: string;
  } = {},
): Promise<IssueFromSourceResult> {
  const settings = await getFiscalSettings(tenantId);
  if (!settings) {
    throw new Error("FISCAL_NAO_CONFIGURADO");
  }

  const snap = await db.collection("proposals").doc(proposalId).get();
  if (!snap.exists) {
    throw new Error("PROPOSTA_NAO_ENCONTRADA");
  }

  const proposal = snap.data() as ProposalDocument;
  if (proposal.tenantId !== tenantId) {
    throw new Error("FORBIDDEN_TENANT_MISMATCH");
  }
  if (!proposal.clientId) {
    throw new Error("PROPOSTA_SEM_CLIENTE");
  }

  const assembly = await assembleInvoices({
    tenantId,
    settings,
    clientId: proposal.clientId,
    items: proposal.products ?? [],
    naturezaOperacao: options.naturezaOperacao,
    observacoes: options.observacoes,
    proposalId,
  });

  return dispatch(assembly, {
    tenantId,
    settings,
    proposalId,
    transactionId: options.transactionId,
    createdBy: options.createdBy,
  });
}

interface ContractLineDocument {
  kind?: string;
  refId?: string | null;
  name?: string;
  quantity?: number;
  unitPrice?: number;
}

/**
 * Os itens da nota da mensalidade: as linhas de SERVIÇO do contrato, com o
 * valor levado ao do lançamento. O lançamento é o que o cliente pagou; se o
 * contrato mudou de valor depois de lançar o mês, a nota acompanha o
 * lançamento, na proporção das linhas. Linha avulsa (sem item do catálogo)
 * fica de fora: sem o serviço cadastrado não há código de serviço para a nota.
 */
export function contractInvoiceItems(lines: readonly ContractLineDocument[], amount: number): ProposalItem[] {
  const services = lines.filter(
    (line) => line.kind === "service" && typeof line.refId === "string" && line.refId && Number(line.quantity) > 0,
  );
  const base = services.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unitPrice ?? 0), 0);
  if (services.length === 0 || base <= 0 || amount <= 0) return [];
  const factor = amount / base;
  let assigned = 0;
  return services.map((line, index) => {
    const lineTotal =
      index === services.length - 1
        ? Math.round((amount - assigned) * 100) / 100
        : Math.round(Number(line.quantity) * Number(line.unitPrice ?? 0) * factor * 100) / 100;
    assigned += lineTotal;
    const quantity = Number(line.quantity);
    return {
      productId: String(line.refId),
      productName: line.name,
      itemType: "service" as const,
      quantity,
      unitPrice: Math.round((lineTotal / quantity) * 100) / 100,
      total: lineTotal,
    };
  });
}

/**
 * Emite a NFS-e da mensalidade de um contrato, a partir do lançamento do mês.
 * O lançamento não tem proposta: os itens vêm das linhas do contrato.
 */
async function issueFromContractCharge(
  tenantId: string,
  transactionId: string,
  transaction: TransactionDocument & { serviceContractId?: string; amount?: number },
  options: { createdBy?: string; naturezaOperacao?: NaturezaOperacao },
): Promise<IssueFromSourceResult> {
  const settings = await getFiscalSettings(tenantId);
  if (!settings) {
    throw new Error("FISCAL_NAO_CONFIGURADO");
  }
  const contractSnap = await db.collection("service_contracts").doc(String(transaction.serviceContractId)).get();
  const contract = contractSnap.data() as { tenantId?: string; clientId?: string; lines?: ContractLineDocument[] } | undefined;
  if (!contractSnap.exists || contract?.tenantId !== tenantId) {
    throw new Error("CONTRATO_NAO_ENCONTRADO");
  }
  const clientId = transaction.clientId || contract.clientId;
  if (!clientId) {
    throw new Error("CONTRATO_SEM_CLIENTE");
  }
  const items = contractInvoiceItems(contract.lines ?? [], Number(transaction.amount ?? 0));
  if (items.length === 0) {
    throw new Error("CONTRATO_SEM_SERVICO");
  }

  const assembly = await assembleInvoices({
    tenantId,
    settings,
    clientId,
    items,
    naturezaOperacao: options.naturezaOperacao,
    observacoes: transaction.description,
    transactionId,
  });
  return dispatch(assembly, { tenantId, settings, transactionId, createdBy: options.createdBy });
}

/** Nota que já existe e conta como "esta proposta já foi faturada". */
export interface ExistingInvoiceSummary {
  id: string;
  type: FiscalDocumentType;
  status: FiscalInvoiceStatus;
  numero?: string;
  serie?: string;
}

export interface IssuePreview {
  /** Emissão configurada, credenciada e sem lacunas. */
  canIssue: boolean;
  /** Motivo de `canIssue` ser falso, para o chamador não ter que deduzir. */
  reason?:
    | "FISCAL_NAO_CONFIGURADO"
    | "FISCAL_NAO_PRONTO"
    | "FISCAL_INCOMPLETO"
    | "FISCAL_COTA_MENSAL_ATINGIDA"
    | "PROPOSTA_SEM_CLIENTE";
  /** Franquia do mes. `limit: -1` = ilimitado (Enterprise). */
  cota?: InvoiceQuota;
  gaps: FiscalGap[];
  /** Uma entrada por documento que seria emitido — duas numa venda mista. */
  documentos: Array<{ type: FiscalDocumentType; valorTotal: number }>;
  /**
   * Notas autorizadas ou em processamento já vindas desta proposta.
   *
   * Rejeitada, cancelada e com erro ficam de fora: nenhuma delas é documento
   * válido, e reemitir depois de uma rejeição é o caminho normal — avisar ali
   * seria só atrito.
   */
  jaEmitidas: ExistingInvoiceSummary[];
}

/**
 * Responde "dá para emitir e o que sairia", sem emitir nada.
 *
 * Reaproveita `assembleInvoices`, que monta os documentos e acumula as lacunas
 * mas não despacha — quem despacha é `dispatch`, e ele não é chamado aqui. Por
 * isso a resposta é exatamente a mesma que a emissão daria, e não uma segunda
 * implementação da regra que poderia divergir dela em silêncio.
 */
export async function previewFromProposal(
  tenantId: string,
  proposalId: string,
): Promise<IssuePreview> {
  const empty = { gaps: [], documentos: [], jaEmitidas: [] };

  const settings = await getFiscalSettings(tenantId);
  if (!settings) {
    return { canIssue: false, reason: "FISCAL_NAO_CONFIGURADO", ...empty };
  }

  const snap = await db.collection("proposals").doc(proposalId).get();
  if (!snap.exists) {
    throw new Error("PROPOSTA_NAO_ENCONTRADA");
  }
  const proposal = snap.data() as ProposalDocument;
  if (proposal.tenantId !== tenantId) {
    throw new Error("FORBIDDEN_TENANT_MISMATCH");
  }

  const jaEmitidas = (await listInvoicesByProposal(tenantId, proposalId))
    .filter((inv) => inv.status === "authorized" || inv.status === "processing")
    .map((inv) => ({
      id: inv.id,
      type: inv.type,
      status: inv.status,
      numero: inv.numero,
      serie: inv.serie,
    }));

  if (!proposal.clientId) {
    return { canIssue: false, reason: "PROPOSTA_SEM_CLIENTE", ...empty, jaEmitidas };
  }

  // Só `ready` prova credenciamento na SEFAZ/prefeitura. Antes disso a emissão
  // sairia, mas voltaria rejeitada — e o convite teria sido uma armadilha.
  if (settings.status !== "ready") {
    return { canIssue: false, reason: "FISCAL_NAO_PRONTO", ...empty, jaEmitidas };
  }

  const assembly = await assembleInvoices({
    tenantId,
    settings,
    clientId: proposal.clientId,
    items: proposal.products ?? [],
    proposalId,
  });

  // Convidar a emitir uma nota que o 402 vai recusar seria o mesmo erro do
  // convite sobre emitente nao credenciado.
  const cota = await getInvoiceQuota(tenantId);
  const semCota =
    assembly.invoices.length > 0 && remainingInvoices(cota) < assembly.invoices.length;

  return {
    canIssue:
      assembly.gaps.length === 0 && assembly.invoices.length > 0 && !semCota,
    reason:
      assembly.gaps.length > 0
        ? "FISCAL_INCOMPLETO"
        : semCota
          ? "FISCAL_COTA_MENSAL_ATINGIDA"
          : undefined,
    cota,
    gaps: assembly.gaps,
    documentos: assembly.invoices.map((inv) => ({
      type: inv.type,
      valorTotal: inv.valorTotal,
    })),
    jaEmitidas,
  };
}

/**
 * Emite a partir de um lançamento financeiro.
 *
 * O lançamento carrega o valor, não os itens — então a nota é montada a partir
 * da proposta vinculada. Um lançamento avulso não tem o que virar linha de nota
 * e falha com erro explícito, em vez de o sistema inventar um item.
 */
export async function issueFromTransaction(
  tenantId: string,
  transactionId: string,
  options: { createdBy?: string; naturezaOperacao?: NaturezaOperacao } = {},
): Promise<IssueFromSourceResult> {
  const snap = await db.collection("transactions").doc(transactionId).get();
  if (!snap.exists) {
    throw new Error("LANCAMENTO_NAO_ENCONTRADO");
  }

  const transaction = snap.data() as TransactionDocument & { serviceContractId?: string; amount?: number };
  if (transaction.tenantId !== tenantId) {
    throw new Error("FORBIDDEN_TENANT_MISMATCH");
  }
  if (transaction.serviceContractId) {
    return issueFromContractCharge(tenantId, transactionId, transaction, options);
  }
  if (!transaction.proposalId) {
    throw new Error("LANCAMENTO_SEM_PROPOSTA");
  }

  return issueFromProposal(tenantId, transaction.proposalId, {
    ...options,
    transactionId,
    observacoes: transaction.description,
  });
}

/**
 * Cria e envia cada documento montado.
 *
 * Tudo ou nada: com qualquer lacuna, nenhum documento é criado. Uma nota criada
 * e não enviada polui a listagem, e meia venda mista faturada é pior que
 * nenhuma.
 */
async function dispatch(
  assembly: AssemblyResult,
  context: {
    tenantId: string;
    settings: { environment: string; provider: "focus" | "asaas" | "govbr" };
    proposalId?: string;
    transactionId?: string;
    createdBy?: string;
  },
): Promise<IssueFromSourceResult> {
  if (assembly.gaps.length > 0) {
    return { invoices: [], gaps: assembly.gaps };
  }
  if (assembly.invoices.length === 0) {
    throw new Error("NADA_A_EMITIR");
  }

  await assertInvoiceQuota(context.tenantId, assembly.invoices.length);

  const issued: InvoiceDocument[] = [];

  for (const assembled of assembly.invoices) {
    const invoice = await createInvoice({
      tenantId: context.tenantId,
      type: assembled.type,
      environment: context.settings.environment,
      valorTotal: assembled.valorTotal,
      clientId: assembly.client.id,
      clientName: assembly.client.nome,
      transactionId: context.transactionId,
      proposalId: context.proposalId,
      createdBy: context.createdBy,
      provider: context.settings.provider,
    });

    issued.push(await issueInvoice(invoice.id, assembled.input));
  }

  logger.info("Documentos fiscais enviados", {
    tenantId: context.tenantId,
    proposalId: context.proposalId,
    total: issued.length,
    tipos: issued.map((invoice) => invoice.type),
  });

  return { invoices: issued, gaps: [] };
}

async function isContractCharge(transactionId: string): Promise<boolean> {
  const snap = await db.collection("transactions").doc(transactionId).get();
  return Boolean(snap.data()?.serviceContractId);
}

/**
 * Dispara a emissão automática de um gatilho, sem nunca derrubar o fluxo que a
 * chamou.
 *
 * Um pagamento confirmado ou uma proposta aprovada não podem falhar porque a
 * nota não saiu: a venda aconteceu de qualquer forma. A falha é registrada e a
 * nota fica visível como pendente, para o usuário resolver.
 */
export async function tryAutoIssue(
  tenantId: string,
  rule: "on_payment" | "on_proposal_approved",
  params: { proposalId?: string; transactionId?: string; createdBy?: string },
): Promise<void> {
  try {
    const settings = await getFiscalSettings(tenantId);
    // `ready` é o único estado que prova credenciamento na SEFAZ/prefeitura.
    // Disparar antes disso só produziria rejeição.
    if (!settings || settings.autoIssueRule !== rule || settings.status !== "ready") {
      return;
    }
    // O gatilho roda fora de qualquer rota, entao o gate de plano nao passa
    // por aqui: sem esta checagem um tenant que perdeu o modulo continuaria
    // emitindo (e consumindo Focus) pela configuracao antiga.
    const { capabilities } = await resolveTenantCapabilities(tenantId);
    if (!capabilities.fiscal) {
      return;
    }
    // Mensalidade de contrato segue a chave do próprio contrato, emitida pelo
    // gatilho do lançamento (`contract-invoice.ts`). Emitir também por aqui
    // daria duas notas para o mesmo pagamento.
    if (params.transactionId && (await isContractCharge(params.transactionId))) {
      return;
    }

    const result = params.transactionId
      ? await issueFromTransaction(tenantId, params.transactionId, {
          createdBy: params.createdBy,
        })
      : params.proposalId
        ? await issueFromProposal(tenantId, params.proposalId, {
            createdBy: params.createdBy,
          })
        : { invoices: [], gaps: [] };

    if (result.gaps.length > 0) {
      logger.warn("Emissão automática pulada por dados fiscais incompletos", {
        tenantId,
        rule,
        lacunas: result.gaps.length,
        campos: result.gaps.map((gap) => `${gap.scope}.${gap.field}`).slice(0, 10),
      });
    }
  } catch (error) {
    logger.error("Emissão automática falhou", {
      tenantId,
      rule,
      ...params,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
