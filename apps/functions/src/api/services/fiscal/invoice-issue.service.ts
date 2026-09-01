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
    | "PROPOSTA_SEM_CLIENTE";
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

  return {
    canIssue: assembly.gaps.length === 0 && assembly.invoices.length > 0,
    reason: assembly.gaps.length > 0 ? "FISCAL_INCOMPLETO" : undefined,
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

  const transaction = snap.data() as TransactionDocument;
  if (transaction.tenantId !== tenantId) {
    throw new Error("FORBIDDEN_TENANT_MISMATCH");
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
