import { db } from "../../init";
import { logger } from "../../lib/logger";
import { TOOL_REGISTRY } from "./index";
import { ToolSchemas } from "./schemas";
import type { TenantPlanTier } from "../../lib/tenant-plan-policy";

// Service imports — per user decision: tools call extracted service functions
import * as proposalsService from "../../api/services/proposals.service";
import * as contactsService from "../../api/services/contacts.service";
import * as productsService from "../../api/services/products.service";
import {
  listTransactionsForAi,
  createTransactionForAi,
  deleteTransactionForAi,
  payInstallmentForAi,
} from "../../api/services/transaction.service";
import * as walletsService from "../../api/services/wallets.service";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ToolCallContext {
  tenantId: string;
  uid: string;
  role: string;
  planTier: Exclude<TenantPlanTier, "free">;
  /** From AiChatRequest.confirmed (request body), NOT from tool args */
  confirmed?: boolean;
}

export interface ToolCallResult {
  success: boolean;
  data?: unknown;
  error?: string;
  requiresConfirmation?: boolean;
  confirmationData?: {
    action: string;
    affectedRecords: string[];
    severity: "low" | "high";
  };
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Converts dd/MM/yyyy to YYYY-MM-DD.
 * Falls back to the original string if format does not match.
 */
function parseBrDate(brDate: string): string {
  const match = brDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return brDate;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function validateArgs(
  toolName: string,
  args: Record<string, unknown>,
): { valid: boolean; data?: unknown; error?: string } {
  const schema = ToolSchemas[toolName];
  if (!schema) return { valid: true, data: args };
  const result = schema.safeParse(args);
  if (!result.success) {
    return { valid: false, error: result.error.issues[0]?.message ?? "Dados invalidos." };
  }
  return { valid: true, data: result.data };
}

// Duplicate from index.ts for double-validation (no cross-import of private constants)
const PLAN_RANK: Record<Exclude<TenantPlanTier, "free">, number> = {
  starter: 1,
  pro: 2,
  enterprise: 3,
};

const ADMIN_ROLES = new Set(["MASTER", "ADMIN", "WK", "SUPERADMIN"]);

// ─── Handler type ─────────────────────────────────────────────────────────────

type ToolHandler = (
  args: Record<string, unknown>,
  ctx: ToolCallContext,
) => Promise<ToolCallResult>;

// ─── Helpers for proposal item mapping ───────────────────────────────────────

/** AI tool items use productId+unitPrice; service uses name+price. Resolves product names. */
async function resolveProposalItems(
  rawItems: unknown[],
  tenantId: string,
): Promise<proposalsService.CreateProposalParams["items"]> {
  return Promise.all(
    rawItems.map(async (item) => {
      const i = item as Record<string, unknown>;
      const productId = i.productId as string | undefined;
      let name = "";

      if (productId) {
        try {
          const product = await productsService.getProduct(productId, tenantId);
          name = product.name;
        } catch {
          // Product not found — use productId as name fallback
          name = productId;
        }
      }

      return {
        productId,
        name,
        quantity: i.quantity as number,
        price: (i.unitPrice as number) ?? 0,
        description: i.description as string | undefined,
      };
    }),
  );
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

const HANDLERS: Record<string, ToolHandler> = {
  // ─── Utilities ──────────────────────────────────────────────────────────────

  request_confirmation: async (args) => {
    return {
      success: true,
      requiresConfirmation: true,
      confirmationData: {
        action: args.action as string,
        affectedRecords: args.affectedRecords as string[],
        severity: args.severity as "low" | "high",
      },
    };
  },

  get_tenant_summary: async (_args, ctx) => {
    const tenantSnap = await db.collection("tenants").doc(ctx.tenantId).get();
    if (!tenantSnap.exists) {
      return { success: false, error: "Tenant nao encontrado." };
    }
    const tenantData = tenantSnap.data()!;

    const now = new Date();
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    let usage: Record<string, unknown> = {};

    try {
      const usageSnap = await db
        .collection("tenants")
        .doc(ctx.tenantId)
        .collection("aiUsage")
        .doc(month)
        .get();
      if (usageSnap.exists) {
        usage = usageSnap.data() as Record<string, unknown>;
      }
    } catch {
      // non-fatal: usage data unavailable
    }

    return {
      success: true,
      data: {
        tenantName: tenantData.name || tenantData.companyName || "",
        planTier: ctx.planTier,
        aiUsage: {
          month,
          messagesUsed: usage.messagesUsed ?? 0,
          totalTokensUsed: usage.totalTokensUsed ?? 0,
        },
      },
    };
  },

  search_help: async () => {
    return {
      success: true,
      data: {
        message:
          "Funcionalidade de busca de ajuda sera implementada em uma versao futura. Por enquanto, posso ajudar respondendo perguntas diretamente.",
      },
    };
  },

  // ─── Proposals ──────────────────────────────────────────────────────────────

  list_proposals: async (args, ctx) => {
    const data = await proposalsService.listProposals(ctx.tenantId, {
      status: args.status as string | undefined,
      search: args.search as string | undefined,
      limit: Number(args.limit) || 10,
    });
    return { success: true, data };
  },

  get_proposal: async (args, ctx) => {
    const data = await proposalsService.getProposal(
      args.proposalId as string,
      ctx.tenantId,
    );
    return { success: true, data };
  },

  create_proposal: async (args, ctx) => {
    const rawItems = (args.items as unknown[]) || [];
    const items = await resolveProposalItems(rawItems, ctx.tenantId);
    const result = await proposalsService.createProposal(
      {
        clientId: args.clientId as string,
        title: args.title as string | undefined,
        items,
        notes: args.notes as string | undefined,
        validUntil: args.validUntil as string | undefined,
        discount: args.discount as number | undefined,
      },
      ctx.tenantId,
      ctx.uid,
    );
    return { success: true, data: result };
  },

  update_proposal: async (args, ctx) => {
    const { proposalId, ...rest } = args;
    const updates: proposalsService.UpdateProposalParams = {
      title: rest.title as string | undefined,
      notes: rest.notes as string | undefined,
      validUntil: rest.validUntil as string | undefined,
      discount: rest.discount as number | undefined,
    };

    if (rest.items) {
      const rawItems = (rest.items as unknown[]) || [];
      updates.items = await resolveProposalItems(rawItems, ctx.tenantId);
    }

    const result = await proposalsService.updateProposal(
      proposalId as string,
      updates,
      ctx.tenantId,
    );
    return { success: true, data: result };
  },

  update_proposal_status: async (args, ctx) => {
    const result = await proposalsService.updateProposalStatus(
      args.proposalId as string,
      args.newStatus as string,
      ctx.tenantId,
      args.reason as string | undefined,
    );
    return { success: true, data: result };
  },

  delete_proposal: async (args, ctx) => {
    if (ctx.confirmed !== true) {
      return {
        success: false,
        error: "Confirmacao obrigatoria. Use request_confirmation antes de deletar.",
      };
    }
    const result = await proposalsService.deleteProposal(
      args.proposalId as string,
      ctx.tenantId,
    );
    return { success: true, data: result };
  },

  // ─── Contacts ───────────────────────────────────────────────────────────────

  list_contacts: async (args, ctx) => {
    const data = await contactsService.listContacts(ctx.tenantId, {
      search: args.search as string | undefined,
      limit: Number(args.limit) || 10,
    });
    return { success: true, data };
  },

  get_contact: async (args, ctx) => {
    const data = await contactsService.getContact(
      args.contactId as string,
      ctx.tenantId,
    );
    return { success: true, data };
  },

  create_contact: async (args, ctx) => {
    const result = await contactsService.createContact(
      {
        name: args.name as string,
        email: args.email as string | undefined,
        phone: args.phone as string | undefined,
        document: args.document as string | undefined,
        address: args.address as string | undefined,
        notes: args.notes as string | undefined,
      },
      ctx.tenantId,
      ctx.uid,
    );
    return { success: true, data: result };
  },

  update_contact: async (args, ctx) => {
    const { contactId, ...updates } = args;
    const result = await contactsService.updateContact(
      contactId as string,
      updates as contactsService.UpdateContactParams,
      ctx.tenantId,
    );
    return { success: true, data: result };
  },

  delete_contact: async (args, ctx) => {
    if (ctx.confirmed !== true) {
      return {
        success: false,
        error: "Confirmacao obrigatoria. Use request_confirmation antes de deletar.",
      };
    }
    const result = await contactsService.deleteContact(
      args.contactId as string,
      ctx.tenantId,
    );
    return { success: true, data: result };
  },

  // ─── Products ───────────────────────────────────────────────────────────────

  list_products: async (args, ctx) => {
    const data = await productsService.listProducts(ctx.tenantId, {
      search: args.search as string | undefined,
      limit: Number(args.limit) || 10,
      category: args.category as string | undefined,
    });
    return { success: true, data };
  },

  get_product: async (args, ctx) => {
    const data = await productsService.getProduct(
      args.productId as string,
      ctx.tenantId,
    );
    return { success: true, data };
  },

  create_product: async (args, ctx) => {
    const result = await productsService.createProduct(
      {
        name: args.name as string,
        description: args.description as string | undefined,
        price: args.price as number | undefined,
        category: args.category as string | undefined,
        manufacturer: args.manufacturer as string | undefined,
      },
      ctx.tenantId,
      ctx.uid,
    );
    return { success: true, data: result };
  },

  update_product: async (args, ctx) => {
    const { productId, ...updates } = args;
    const result = await productsService.updateProduct(
      productId as string,
      updates as productsService.UpdateProductParams,
      ctx.tenantId,
    );
    return { success: true, data: result };
  },

  delete_product: async (args, ctx) => {
    if (ctx.confirmed !== true) {
      return {
        success: false,
        error: "Confirmacao obrigatoria. Use request_confirmation antes de deletar.",
      };
    }
    const result = await productsService.deleteProduct(
      args.productId as string,
      ctx.tenantId,
    );
    return { success: true, data: result };
  },

  // ─── Financial ──────────────────────────────────────────────────────────────

  list_transactions: async (args, ctx) => {
    const startDate = args.startDate
      ? parseBrDate(args.startDate as string)
      : undefined;
    const endDate = args.endDate
      ? parseBrDate(args.endDate as string)
      : undefined;
    const data = await listTransactionsForAi(ctx.tenantId, {
      type: args.type as string | undefined,
      walletId: args.walletId as string | undefined,
      startDate,
      endDate,
      limit: Number(args.limit) || 20,
    });
    return { success: true, data };
  },

  create_transaction: async (args, ctx) => {
    const date = parseBrDate(args.date as string);
    const result = await createTransactionForAi(
      {
        type: args.type as "income" | "expense",
        description: args.description as string,
        amount: args.amount as number,
        walletId: args.walletId as string,
        date,
        category: args.category as string | undefined,
        installments: args.installments as number | undefined,
        proposalId: args.proposalId as string | undefined,
      },
      ctx.tenantId,
      ctx.uid,
    );
    return { success: true, data: result };
  },

  delete_transaction: async (args, ctx) => {
    if (ctx.confirmed !== true) {
      return {
        success: false,
        error: "Confirmacao obrigatoria. Use request_confirmation antes de deletar.",
      };
    }
    const result = await deleteTransactionForAi(
      args.transactionId as string,
      ctx.tenantId,
    );
    return { success: true, data: result };
  },

  list_wallets: async (_args, ctx) => {
    const data = await walletsService.listWallets(ctx.tenantId);
    return { success: true, data };
  },

  create_wallet: async (args, ctx) => {
    const result = await walletsService.createWallet(
      {
        name: args.name as string,
        type: args.type as string,
        color: args.color as string,
        description: args.description as string | undefined,
        initialBalance: args.initialBalance as number | undefined,
      },
      ctx.tenantId,
    );
    return { success: true, data: result };
  },

  transfer_between_wallets: async (args, ctx) => {
    const result = await walletsService.transferBetweenWallets(
      {
        fromWalletId: args.fromWalletId as string,
        toWalletId: args.toWalletId as string,
        amount: args.amount as number,
        description: args.description as string | undefined,
      },
      ctx.tenantId,
    );
    return { success: true, data: result };
  },

  pay_installment: async (args, ctx) => {
    const paidAt = args.paidAt ? parseBrDate(args.paidAt as string) : undefined;
    const result = await payInstallmentForAi(
      args.transactionId as string,
      Number(args.installmentNumber),
      ctx.tenantId,
      paidAt,
    );
    return { success: true, data: result };
  },

  // ─── CRM ────────────────────────────────────────────────────────────────────

  list_crm_leads: async (args, ctx) => {
    const data = await proposalsService.listProposals(ctx.tenantId, {
      status: args.status as string | undefined,
      limit: Number(args.limit) || 20,
    });
    return { success: true, data };
  },

  update_crm_status: async (args, ctx) => {
    const result = await proposalsService.updateProposalStatus(
      args.proposalId as string,
      args.newStatusId as string,
      ctx.tenantId,
    );
    return { success: true, data: result };
  },

  // ─── WhatsApp ───────────────────────────────────────────────────────────────

  send_whatsapp_message: async () => {
    return {
      success: false,
      error:
        "Envio de WhatsApp via Lia sera habilitado em uma versao futura. Use o painel de WhatsApp do ProOps.",
    };
  },
};

// ─── Main dispatcher ──────────────────────────────────────────────────────────

/**
 * Executes a tool call from the Gemini model.
 *
 * Double-validates plan tier and role before dispatching to the handler.
 * All handlers call extracted service functions — never Firestore directly
 * (except get_tenant_summary which reads the tenant document).
 */
export async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ToolCallContext,
): Promise<ToolCallResult> {
  // 1. Find tool in registry
  const entry = TOOL_REGISTRY.find((e) => e.declaration.name === toolName);
  if (!entry) {
    return { success: false, error: `Tool desconhecida: ${toolName}` };
  }

  // 2. Double-validate plan tier
  if (PLAN_RANK[entry.minPlan] > PLAN_RANK[ctx.planTier]) {
    return {
      success: false,
      error: `Tool ${toolName} requer plano ${entry.minPlan} ou superior. Seu plano: ${ctx.planTier}.`,
    };
  }

  // 3. Double-validate role
  const isAdmin = ADMIN_ROLES.has(ctx.role.toUpperCase());
  if (entry.minRole === "admin" && !isAdmin) {
    return {
      success: false,
      error: `Tool ${toolName} requer permissao de administrador.`,
    };
  }

  // 4. Validate args with Zod schema (if schema exists for this tool)
  const validation = validateArgs(toolName, args);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // 5. Dispatch to handler
  const handler = HANDLERS[toolName];
  if (!handler) {
    return { success: false, error: `Handler nao implementado: ${toolName}` };
  }

  try {
    const result = await handler(
      validation.data as Record<string, unknown>,
      ctx,
    );
    // 6. Log tool execution
    logger.info("AI tool executed", {
      tenantId: ctx.tenantId,
      uid: ctx.uid,
      tool: toolName,
      success: result.success,
    });
    return result;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro interno ao executar tool.";
    logger.error("AI tool execution error", {
      tenantId: ctx.tenantId,
      uid: ctx.uid,
      tool: toolName,
      error: message,
    });
    return { success: false, error: message };
  }
}
