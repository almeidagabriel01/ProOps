import { Request, Response } from "express";
import {
  CreateTransactionDTO,
  validateTransactionData,
} from "../helpers/transaction-validation";
import { TransactionService } from "../services/transaction.service";
import { z } from "zod";
import { sanitizeText, sanitizeRichText } from "../../utils/sanitize";

const CreateTransactionSchema = z.object({
  description: z.string().min(1).max(500).trim(),
  amount: z.number().positive("O valor deve ser maior que zero."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (YYYY-MM-DD)."),
  type: z.enum(["income", "expense"]),
  status: z.enum(["paid", "pending", "overdue"]),
  dueDate: z.string().max(10).optional(),
  clientId: z.string().max(100).optional(),
  clientName: z.string().max(200).optional(),
  proposalId: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  wallet: z.string().max(200).optional(),
  targetTenantId: z.string().max(100).optional(),
  notes: z.string().max(2000).trim().optional(),
  // Installment/recurring fields — passed through without strict validation
  isDownPayment: z.boolean().optional(),
  downPaymentType: z.string().max(50).optional(),
  downPaymentPercentage: z.number().min(0).max(100).optional(),
  isInstallment: z.boolean().optional(),
  installmentCount: z.number().int().min(1).max(120).optional(),
  installmentNumber: z.number().int().min(0).optional().nullable(),
  installmentGroupId: z.string().max(100).optional().nullable(),
  installmentInterval: z.number().int().min(1).max(365).optional(),
  isRecurring: z.boolean().optional(),
  recurringGroupId: z.string().max(100).optional(),
  paymentMode: z.enum(["total", "installmentValue"]).optional(),
  extraCosts: z.array(z.unknown()).max(50).optional(),
  downPayment: z.object({
    amount: z.number().positive(),
    date: z.string(),
    dueDate: z.string().optional(),
    wallet: z.string().max(200).optional(),
    status: z.enum(["paid", "pending", "overdue"]),
    downPaymentType: z.string().max(50).optional(),
    downPaymentPercentage: z.number().min(0).max(100).optional(),
    installmentNumber: z.number().int().optional(),
    installmentCount: z.number().int().optional(),
    paymentMode: z.enum(["total", "installmentValue"]).optional(),
    notes: z.string().max(2000).optional(),
  }).optional(),
});

const UpdateTransactionSchema = z.object({
  description: z.string().min(1).max(500).trim().optional(),
  amount: z.number().positive().optional(),
  date: z.string().max(10).optional(),
  type: z.enum(["income", "expense"]).optional(),
  status: z.enum(["paid", "pending", "overdue"]).optional(),
  dueDate: z.string().max(10).optional().nullable(),
  clientId: z.string().max(100).optional().nullable(),
  clientName: z.string().max(200).optional().nullable(),
  proposalId: z.string().max(100).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  wallet: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).trim().optional().nullable(),
  isDownPayment: z.boolean().optional(),
  isInstallment: z.boolean().optional(),
  installmentCount: z.number().int().min(1).max(120).optional(),
  installmentNumber: z.number().int().min(0).optional().nullable(),
  installmentGroupId: z.string().max(100).optional().nullable(),
  isRecurring: z.boolean().optional(),
  paymentMode: z.enum(["total", "installmentValue"]).optional(),
  extraCosts: z.array(z.unknown()).max(50).optional(),
}).passthrough();

function mapTransactionErrorStatus(message: string): number {
  if (
    message.startsWith("FORBIDDEN_") ||
    message.startsWith("AUTH_CLAIMS_MISSING_") ||
    message.includes("Sem permiss") ||
    message.includes("Acesso negado")
  ) {
    return 403;
  }
  if (message.includes("não encontrada")) return 404;
  if (
    message.includes("Dados inválidos") ||
    message.includes("Status inválido") ||
    message.includes("ID inválido")
  ) {
    return 400;
  }
  return 500;
}

export const createTransaction = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;

    const parseResult = CreateTransactionSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || "Dados inválidos.";
      return res.status(400).json({ message: firstError });
    }
    const data = parseResult.data as CreateTransactionDTO;

    // Sanitize text fields
    data.description = sanitizeText(data.description);
    if (data.clientName) data.clientName = sanitizeText(data.clientName);
    if (data.notes) data.notes = sanitizeRichText(data.notes);
    if (data.category) data.category = sanitizeText(data.category);

    // Validation (legacy — retained for business rules)
    const validation = validateTransactionData(data);
    if (!validation.isValid) {
      return res.status(400).json({ message: validation.message });
    }

    // Safety Lock: Prevent ghost installments on create
    if (!data.isInstallment && !data.isDownPayment && !data.isRecurring) {
      data.installmentCount = 1;
      // Preserve group link when:
      // a) This is the "restante" member of a down payment group (installmentNumber > 0), OR
      // b) A bundled downPayment is present — both documents must share the same groupId.
      if (!(data.installmentNumber != null && data.installmentNumber > 0) && !data.downPayment) {
        delete data.installmentNumber;
        delete data.installmentGroupId;
      }
    }

    const result = await TransactionService.createTransaction(
      userId,
      req.user,
      data,
    );

    return res.status(201).json({
      success: true,
      transactionId: result.transactionId,
      message:
        result.count > 1
          ? `${result.count} parcelas criadas.`
          : "Transação criada.",
    });
  } catch (error: unknown) {
    console.error("createTransaction Error:", error);
    const message = error instanceof Error ? error.message : "Erro interno.";
    return res.status(mapTransactionErrorStatus(message)).json({ message });
  }
};

export const updateTransaction = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;

    if (!id) return res.status(400).json({ message: "ID inválido." });

    const parseResult = UpdateTransactionSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || "Dados inválidos.";
      return res.status(400).json({ message: firstError });
    }
    const updateData = req.body;

    // Sanitize text fields
    if (typeof updateData.description === "string") updateData.description = sanitizeText(updateData.description);
    if (typeof updateData.clientName === "string") updateData.clientName = sanitizeText(updateData.clientName);
    if (typeof updateData.notes === "string") updateData.notes = sanitizeRichText(updateData.notes);
    if (typeof updateData.category === "string") updateData.category = sanitizeText(updateData.category);

    // Safety Lock: Prevent ghost installments on update
    if (updateData.isInstallment === false && updateData.isDownPayment !== true && updateData.isRecurring !== true) {
      updateData.installmentCount = 1;
      // Preserve group link if this is the "restante" member of a down payment group
      // (identified by an explicit installmentNumber > 0)
      if (!(updateData.installmentNumber != null && updateData.installmentNumber > 0)) {
        updateData.installmentNumber = null;
        updateData.installmentGroupId = null;
      }
    }

    await TransactionService.updateTransaction(
      userId,
      req.user,
      id,
      updateData,
    );

    return res.json({ success: true, message: "Atualizado com sucesso." });
  } catch (error: unknown) {
    console.error("updateTransaction Error:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao atualizar.";
    return res.status(mapTransactionErrorStatus(message)).json({ message });
  }
};

export const updateTransactionWithInstallments = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;
    const payload = req.body;

    if (!id) return res.status(400).json({ message: "ID inválido." });

    await TransactionService.updateFinancialEntryWithInstallments(
      userId,
      req.user,
      id,
      payload,
    );

    return res.json({ success: true, message: "Atualizado com sucesso." });
  } catch (error: unknown) {
    console.error("updateTransactionWithInstallments Error:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao atualizar.";
    return res.status(mapTransactionErrorStatus(message)).json({ message });
  }
};

export const updateTransactionsStatusBatch = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = req.user!.uid;
    const { ids, newStatus } = req.body as {
      ids?: string[];
      newStatus?: "paid" | "pending" | "overdue";
    };

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "IDs inválidos." });
    }

    if (!newStatus || !["paid", "pending", "overdue"].includes(newStatus)) {
      return res.status(400).json({ message: "Status inválido." });
    }

    const count = await TransactionService.updateStatusBatch(
      userId,
      req.user,
      ids,
      newStatus,
    );

    return res.json({
      success: true,
      message: "Status atualizado em lote com sucesso.",
      count,
    });
  } catch (error: unknown) {
    console.error("updateTransactionsStatusBatch Error:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao atualizar status.";
    return res.status(mapTransactionErrorStatus(message)).json({ message });
  }
};

export const deleteTransaction = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;

    if (!id) return res.status(400).json({ message: "ID inválido." });

    await TransactionService.deleteTransaction(userId, req.user, id);

    return res.json({ success: true, message: "Excluído com sucesso." });
  } catch (error: unknown) {
    console.error("deleteTransaction Error:", error);
    const message = error instanceof Error ? error.message : "Erro ao excluir.";
    return res.status(mapTransactionErrorStatus(message)).json({ message });
  }
};

export const deleteTransactionGroup = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { groupId } = req.params;

    if (!groupId) return res.status(400).json({ message: "ID de grupo inválido." });

    await TransactionService.deleteTransactionGroup(userId, req.user, groupId);

    return res.json({ success: true, message: "Grupo excluído com sucesso." });
  } catch (error: unknown) {
    console.error("deleteTransactionGroup Error:", error);
    const message = error instanceof Error ? error.message : "Erro ao excluir grupo.";
    return res.status(mapTransactionErrorStatus(message)).json({ message });
  }
};

export const updateTransactionsBatch = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { updates } = req.body as {
      updates?: Array<{ id?: string; data?: Record<string, unknown> }>;
    };

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ message: "updates deve ser um array não vazio." });
    }

    if (updates.some((u) => !u.id || typeof u.id !== "string" || !u.data || typeof u.data !== "object")) {
      return res.status(400).json({ message: "Cada item de updates deve ter id (string) e data (object)." });
    }

    const count = await TransactionService.updateTransactionsBatch(
      userId,
      req.user,
      updates as Array<{ id: string; data: Record<string, unknown> }>,
    );

    return res.json({ success: true, message: `${count} lançamentos atualizados com sucesso.`, count });
  } catch (error: unknown) {
    console.error("updateTransactionsBatch Error:", error);
    const message = error instanceof Error ? error.message : "Erro ao atualizar em lote.";
    return res.status(mapTransactionErrorStatus(message)).json({ message });
  }
};

export const updateGroupStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { groupId } = req.params;
    const { newStatus } = req.body as { newStatus?: string };

    if (!groupId) return res.status(400).json({ message: "ID de grupo inválido." });
    if (!newStatus || !["paid", "pending", "overdue"].includes(newStatus)) {
      return res.status(400).json({ message: "Status inválido." });
    }

    const count = await TransactionService.updateGroupStatus(
      userId,
      req.user,
      groupId,
      newStatus as "paid" | "pending" | "overdue",
    );

    return res.json({ success: true, message: `${count} lançamentos do grupo atualizados.`, count });
  } catch (error: unknown) {
    console.error("updateGroupStatus Error:", error);
    const message = error instanceof Error ? error.message : "Erro ao atualizar status do grupo.";
    return res.status(mapTransactionErrorStatus(message)).json({ message });
  }
};

export const registerPartialPayment = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;
    const { amount, date } = req.body as { amount?: number; date?: string };

    if (!id) return res.status(400).json({ message: "ID inválido." });
    if (!amount || amount <= 0) return res.status(400).json({ message: "Valor parcial inválido." });
    if (!date) return res.status(400).json({ message: "Data inválida." });

    await TransactionService.registerPartialPayment(userId, req.user, id, amount, date);

    return res.json({ success: true, message: "Pagamento parcial registrado com sucesso." });
  } catch (error: unknown) {
    console.error("registerPartialPayment Error:", error);
    const message = error instanceof Error ? error.message : "Erro ao registrar pagamento parcial.";
    return res.status(mapTransactionErrorStatus(message)).json({ message });
  }
};
