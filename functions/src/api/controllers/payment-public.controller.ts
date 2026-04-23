import { Request, Response } from "express";
import { TransactionPaymentService } from "../services/transaction-payment.service";

export const createPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const { method, installments, backUrl, transactionId } = req.body as {
      method?: unknown;
      installments?: unknown;
      backUrl?: unknown;
      transactionId?: unknown;
    };

    const validMethods = ["pix", "credit_card", "debit_card", "boleto"];
    if (!method || typeof method !== "string" || !validMethods.includes(method)) {
      res.status(400).json({ message: "Método de pagamento inválido" });
      return;
    }

    const result = await TransactionPaymentService.createPayment({
      token,
      method: method as "pix" | "credit_card" | "debit_card" | "boleto",
      installments: typeof installments === "number" ? installments : undefined,
      backUrl: typeof backUrl === "string" ? backUrl : undefined,
      transactionId: typeof transactionId === "string" ? transactionId : undefined,
    });

    res.status(200).json(result);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    if (err.message === "EXPIRED_LINK") {
      res.status(410).json({ message: "Link expirado" });
      return;
    }
    if (err.message === "MP_NOT_CONFIGURED") {
      res.status(422).json({ message: "Pagamento online não configurado para este tenant" });
      return;
    }
    if (err.message === "ALREADY_PAID") {
      res.status(409).json({ message: "Este lançamento já foi pago" });
      return;
    }
    if (err.message === "TRANSACTION_NOT_FOUND") {
      res.status(404).json({ message: "Lançamento não encontrado" });
      return;
    }
    if (err.message === "FORBIDDEN_TENANT_MISMATCH") {
      res.status(403).json({ message: "Acesso não autorizado" });
      return;
    }
    res.status(500).json({ message: err.message });
  }
};

export const getPaymentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, paymentId } = req.params;
    const result = await TransactionPaymentService.getPaymentStatus(token, paymentId);
    res.status(200).json(result);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    if (err.message === "EXPIRED_LINK") {
      res.status(410).json({ message: "Link expirado" });
      return;
    }
    if (err.message === "PAYMENT_NOT_FOUND") {
      res.status(404).json({ message: "Pagamento não encontrado" });
      return;
    }
    res.status(500).json({ message: err.message });
  }
};
