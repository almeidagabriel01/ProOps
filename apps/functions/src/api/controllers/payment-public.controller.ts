import { Request, Response } from "express";
import { TransactionPaymentService, AsaasApiError } from "../services/transaction-payment.service";
import { AsaasService } from "../services/asaas.service";
import { db } from "../../init";
import { logger } from "../../lib/logger";

export const createPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const {
      method,
      transactionId,
      payerOverride: rawPayerOverride,
    } = req.body as {
      method?: unknown;
      transactionId?: unknown;
      payerOverride?: unknown;
    };

    const validMethods = ["pix", "boleto"];
    if (!method || typeof method !== "string" || !validMethods.includes(method)) {
      res.status(400).json({ message: "Método de pagamento inválido. Apenas PIX e boleto são suportados." });
      return;
    }

    let parsedPayerOverride:
      | {
          identification?: { type: "CPF" | "CNPJ"; number: string };
          firstName?: string;
          lastName?: string;
        }
      | undefined;
    if (rawPayerOverride && typeof rawPayerOverride === "object") {
      const po = rawPayerOverride as Record<string, unknown>;
      const idObj =
        typeof po.identification === "object" && po.identification !== null
          ? (po.identification as Record<string, unknown>)
          : undefined;
      const idType =
        idObj?.type === "CPF" || idObj?.type === "CNPJ" ? idObj.type : undefined;
      const idNumber =
        typeof idObj?.number === "string"
          ? idObj.number.replace(/\D/g, "").slice(0, 14)
          : undefined;

      parsedPayerOverride = {
        identification:
          idType && idNumber ? { type: idType, number: idNumber } : undefined,
        firstName:
          typeof po.firstName === "string"
            ? po.firstName.trim().slice(0, 60)
            : undefined,
        lastName:
          typeof po.lastName === "string"
            ? po.lastName.trim().slice(0, 60)
            : undefined,
      };
    }

    const result = await TransactionPaymentService.createPayment({
      token,
      method: method as "pix" | "boleto",
      transactionId: typeof transactionId === "string" ? transactionId : undefined,
      payerOverride: parsedPayerOverride,
    });

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof AsaasApiError) {
      const statusCode =
        error.asaasStatus === 401 || error.asaasStatus >= 500
          ? 502
          : error.asaasStatus === 429
            ? 429
            : 400;
      res.status(statusCode).json({
        code: error.asaasStatus === 401 ? "ASAAS_AUTH_FAILED" : "ASAAS_REJECTED",
        message:
          error.asaasStatus === 401
            ? "Integração Asaas precisa ser reconectada"
            : error.asaasMessage || "Pagamento recusado pelo Asaas",
        asaasStatus: error.asaasStatus,
      });
      return;
    }
    const err = error instanceof Error ? error : new Error(String(error));
    if (err.message === "EXPIRED_LINK") {
      res.status(410).json({ message: "Link expirado" });
      return;
    }
    if (err.message === "ASAAS_NOT_CONFIGURED") {
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
    if (err.message === "FORBIDDEN_CROSS_GROUP") {
      res
        .status(403)
        .json({ message: "Este lançamento não pertence ao grupo do link compartilhado" });
      return;
    }
    if (err.message === "INVALID_AMOUNT") {
      res
        .status(400)
        .json({ code: "INVALID_AMOUNT", message: "Valor do lançamento inválido" });
      return;
    }
    if (err.message === "INVALID_METHOD") {
      res
        .status(400)
        .json({ code: "INVALID_METHOD", message: "Método de pagamento não suportado" });
      return;
    }
    if (err.message === "INVALID_IDENTIFICATION") {
      res.status(400).json({
        code: "INVALID_IDENTIFICATION",
        message: "CPF ou CNPJ inválido. Verifique os dados e tente novamente.",
      });
      return;
    }
    if (err.message === "BOLETO_MISSING_IDENTIFICATION") {
      res.status(422).json({
        code: "BOLETO_MISSING_IDENTIFICATION",
        message: "Para gerar boleto, o cliente precisa ter CPF ou CNPJ cadastrado.",
      });
      return;
    }
    logger.error("Unexpected error in createPayment", { errorMessage: err.message });
    res.status(500).json({ message: err.message });
  }
};

export const getPaymentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, paymentId } = req.params;
    const result = await TransactionPaymentService.getPaymentStatus(token, paymentId);
    res.setHeader("Cache-Control", "no-store");
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
    logger.error("Unexpected error in getPaymentStatus", { errorMessage: err.message });
    res.status(500).json({ message: err.message });
  }
};

export const getPaymentConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;

    const snapshot = await db
      .collection("shared_transactions")
      .where("token", "==", token)
      .limit(1)
      .get();

    if (snapshot.empty) {
      res.status(410).json({ message: "Link expirado" });
      return;
    }

    const linkData = snapshot.docs[0].data() as {
      tenantId: string;
      expiresAt: string | null;
    };

    if (linkData.expiresAt !== null && new Date(linkData.expiresAt) < new Date()) {
      res.status(410).json({ message: "Link expirado" });
      return;
    }

    const status = await AsaasService.getPublicStatus(linkData.tenantId);

    if (!status.connected) {
      res
        .status(422)
        .json({ message: "Pagamento online não configurado para este tenant" });
      return;
    }

    res.status(200).json({
      gateway: "asaas",
      environment: status.environment,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Unexpected error in getPaymentConfig", { errorMessage: err.message });
    res.status(500).json({ message: err.message });
  }
};
