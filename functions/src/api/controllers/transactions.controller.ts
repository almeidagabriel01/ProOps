import { Request, Response } from "express";
import {
  CreateTransactionDTO,
  validateTransactionData,
} from "../helpers/transaction-validation";
import { TransactionService } from "../services/transaction.service";

function mapTransactionErrorStatus(message: string): number {
  if (
    message.startsWith("FORBIDDEN_") ||
    message.startsWith("AUTH_CLAIMS_MISSING_") ||
    message.includes("Sem permiss") ||
    message.includes("Acesso negado")
  ) {
    return 403;
  }
  if (message.includes("nÃ£o encontrada")) return 404;
  if (
    message.includes("Dados invÃ¡lidos") ||
    message.includes("Status invÃ¡lido") ||
    message.includes("ID invÃ¡lido")
  ) {
    return 400;
  }
  return 500;
}

export const createTransaction = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const data = req.body as CreateTransactionDTO;

    // Validation
    const validation = validateTransactionData(data);
    if (!validation.isValid) {
      return res.status(400).json({ message: validation.message });
    }

    // Safety Lock: Prevent ghost installments
    if (!data.isInstallment && !data.isDownPayment) {
      data.installmentCount = 1;
      delete data.installmentNumber;
      delete data.installmentGroupId;
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
    const updateData = req.body;

    if (!id) return res.status(400).json({ message: "ID inválido." });

    // Safety Lock: Prevent ghost installments on update
    if (updateData.isInstallment === false && updateData.isDownPayment !== true) {
      updateData.installmentCount = 1;
      updateData.installmentNumber = null;
      updateData.installmentGroupId = null;
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
