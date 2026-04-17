import { z } from "zod";

// ─── Address schema (shared) ─────────────────────────────────────────────────

const AddressSchema = z
  .object({
    street: z.string().max(200).trim().optional(),
    number: z.string().max(20).trim().optional(),
    complement: z.string().max(100).trim().optional(),
    city: z.string().max(100).trim().optional(),
    state: z.string().max(2).trim().optional(),
    zipCode: z.string().max(9).trim().optional(),
  })
  .optional();

// ─── Proposal schemas ────────────────────────────────────────────────────────

const VALID_PROPOSAL_STATUSES = ["draft", "sent", "approved", "rejected"] as const;

const SORT_DIRECTION = z.enum(["asc", "desc"]).optional();

export const ListProposalsArgsSchema = z.object({
  // Accept any string from the model, coerce unrecognised values (e.g. "", "all") to undefined
  // so the executor lists all proposals instead of passing a bad filter downstream.
  status: z
    .string()
    .optional()
    .transform((v) => {
      if (v && (VALID_PROPOSAL_STATUSES as readonly string[]).includes(v)) {
        return v as (typeof VALID_PROPOSAL_STATUSES)[number];
      }
      return undefined;
    }),
  search: z.string().max(500).trim().optional(),
  limit: z.number().int().min(1).max(50).optional(),
  orderBy: z.enum(["createdAt", "updatedAt", "title", "clientName"]).optional(),
  direction: SORT_DIRECTION,
});

export const ListContactsArgsSchema = z.object({
  search: z.string().max(500).trim().optional(),
  limit: z.number().int().min(1).max(50).optional(),
  orderBy: z.enum(["createdAt", "name", "updatedAt"]).optional(),
  direction: SORT_DIRECTION,
});

export const ListProductsArgsSchema = z.object({
  search: z.string().max(500).trim().optional(),
  limit: z.number().int().min(1).max(50).optional(),
  category: z.string().max(100).trim().optional(),
  orderBy: z.enum(["createdAt", "name", "price", "updatedAt"]).optional(),
  direction: SORT_DIRECTION,
});

const ProposalItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive("Quantidade deve ser maior que zero."),
  unitPrice: z.number().positive("Preço unitário deve ser maior que zero."),
  description: z.string().max(500).trim().optional(),
});

export const CreateProposalArgsSchema = z.object({
  clientId: z.string().min(1, "clientId é obrigatório."),
  title: z.string().min(1, "Título é obrigatório.").max(300).trim(),
  items: z
    .array(ProposalItemSchema)
    .min(1, "A proposta deve ter pelo menos um item."),
  notes: z.string().max(5000).trim().optional(),
  validUntil: z.string().optional(),
  discount: z.number().min(0).max(100).optional(),
});

export const UpdateProposalArgsSchema = z.object({
  proposalId: z.string().min(1, "proposalId é obrigatório."),
  title: z.string().max(300).trim().optional(),
  items: z.array(ProposalItemSchema).optional(),
  notes: z.string().max(5000).trim().optional(),
  validUntil: z.string().optional(),
  discount: z.number().min(0).max(100).optional(),
});

export const UpdateProposalStatusArgsSchema = z.object({
  proposalId: z.string().min(1, "proposalId é obrigatório."),
  newStatus: z.enum(["sent", "approved", "rejected"]),
  reason: z.string().max(1000).trim().optional(),
});

// ─── Delete factory ──────────────────────────────────────────────────────────

export function makeDeleteSchema(idField: string) {
  return z.object({
    [idField]: z.string().min(1, `${idField} é obrigatório.`),
    confirmed: z.literal(true, {
      error: () => "Confirmacao obrigatoria antes de deletar.",
    }),
  });
}

// ─── Contact schemas ─────────────────────────────────────────────────────────

export const CreateContactArgsSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório.").max(200).trim(),
  email: z.string().email().max(254).optional().or(z.literal("")),
  phone: z.string().max(30).trim().optional(),
  document: z.string().max(20).trim().optional(),
  address: AddressSchema,
  notes: z.string().max(2000).trim().optional(),
});

export const UpdateContactArgsSchema = z.object({
  contactId: z.string().min(1, "contactId é obrigatório."),
  name: z.string().max(200).trim().optional(),
  email: z.string().email().max(254).optional().or(z.literal("")),
  phone: z.string().max(30).trim().optional(),
  document: z.string().max(20).trim().optional(),
  address: AddressSchema,
  notes: z.string().max(2000).trim().optional(),
});

// ─── Product schemas ─────────────────────────────────────────────────────────

export const CreateProductArgsSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório.").max(200).trim(),
  price: z.number().min(0, "Preço não pode ser negativo."),
  category: z.string().min(1, "Categoria é obrigatória.").max(100).trim(),
  manufacturer: z.string().min(1, "Fabricante é obrigatório.").max(200).trim(),
  description: z.string().max(2000).trim().optional(),
});

export const UpdateProductArgsSchema = z.object({
  productId: z.string().min(1, "productId é obrigatório."),
  name: z.string().max(200).trim().optional(),
  description: z.string().max(2000).trim().optional(),
  price: z.number().min(0).optional(),
  category: z.string().max(100).trim().optional(),
  manufacturer: z.string().max(200).trim().optional(),
});

// ─── Transaction schemas ─────────────────────────────────────────────────────

const DD_MM_YYYY = /^\d{2}\/\d{2}\/\d{4}$/;

export const CreateTransactionArgsSchema = z.object({
  type: z.enum(["income", "expense"]),
  description: z.string().min(1, "Descrição é obrigatória.").max(500).trim(),
  amount: z.number().positive("Valor deve ser maior que zero.").max(10_000_000, "Valor máximo por lançamento: R$ 10.000.000."),
  walletId: z.string().min(1, "walletId é obrigatório."),
  date: z
    .string()
    .regex(DD_MM_YYYY, "Data deve estar no formato dd/MM/yyyy."),
  category: z.string().max(100).trim().optional(),
  installments: z.number().int().min(1).max(60).optional(),
  proposalId: z.string().optional(),
});

export const TransferWalletsArgsSchema = z.object({
  fromWalletId: z.string().min(1, "fromWalletId é obrigatório."),
  toWalletId: z.string().min(1, "toWalletId é obrigatório."),
  amount: z.number().positive("Valor deve ser maior que zero.").max(10_000_000, "Valor máximo por transferência: R$ 10.000.000."),
  description: z.string().max(500).trim().optional(),
});

export const CreateWalletArgsSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório.").max(100).trim(),
  type: z.string().min(1).max(50).trim(),
  color: z.string().min(1).max(20).trim(),
  description: z.string().max(500).trim().optional(),
  initialBalance: z.number().optional(),
});

export const PayInstallmentArgsSchema = z.object({
  transactionId: z.string().min(1, "transactionId é obrigatório."),
  installmentNumber: z
    .number()
    .int()
    .positive("Número da parcela deve ser maior que zero."),
  paidAt: z
    .string()
    .regex(DD_MM_YYYY, "Data deve estar no formato dd/MM/yyyy.")
    .optional(),
});

// ─── CRM schemas ─────────────────────────────────────────────────────────────

export const UpdateCrmStatusArgsSchema = z.object({
  proposalId: z.string().min(1, "proposalId é obrigatório."),
  newStatusId: z.string().min(1, "newStatusId é obrigatório."),
});

// ─── WhatsApp schemas ─────────────────────────────────────────────────────────

export const SendWhatsappArgsSchema = z.object({
  contactId: z.string().min(1, "contactId é obrigatório."),
  message: z
    .string()
    .min(1, "Mensagem é obrigatória.")
    .max(4096, "Mensagem não pode ter mais de 4.096 caracteres."),
  templateName: z.string().max(100).trim().optional(),
});

// ─── Utility schemas ──────────────────────────────────────────────────────────

export const RequestConfirmationArgsSchema = z.object({
  action: z.string().min(1, "action é obrigatório."),
  affectedRecords: z.array(z.string()),
  severity: z.enum(["low", "high"]),
});

export const SearchHelpArgsSchema = z.object({
  query: z
    .string()
    .min(1, "query é obrigatório.")
    .max(500),
});

// ─── ToolSchemas registry ────────────────────────────────────────────────────

export const ToolSchemas: Record<string, z.ZodType> = {
  list_proposals: ListProposalsArgsSchema,
  list_contacts: ListContactsArgsSchema,
  list_products: ListProductsArgsSchema,
  create_proposal: CreateProposalArgsSchema,
  update_proposal: UpdateProposalArgsSchema,
  update_proposal_status: UpdateProposalStatusArgsSchema,
  delete_proposal: makeDeleteSchema("proposalId"),
  create_contact: CreateContactArgsSchema,
  update_contact: UpdateContactArgsSchema,
  delete_contact: makeDeleteSchema("contactId"),
  create_product: CreateProductArgsSchema,
  update_product: UpdateProductArgsSchema,
  delete_product: makeDeleteSchema("productId"),
  create_transaction: CreateTransactionArgsSchema,
  delete_transaction: makeDeleteSchema("transactionId"),
  create_wallet: CreateWalletArgsSchema,
  transfer_between_wallets: TransferWalletsArgsSchema,
  pay_installment: PayInstallmentArgsSchema,
  update_crm_status: UpdateCrmStatusArgsSchema,
  send_whatsapp_message: SendWhatsappArgsSchema,
  request_confirmation: RequestConfirmationArgsSchema,
  search_help: SearchHelpArgsSchema,
};
