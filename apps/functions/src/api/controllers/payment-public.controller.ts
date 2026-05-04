import { Request, Response } from "express";
import { TransactionPaymentService, MercadoPagoApiError, ProcessCardPaymentRequest } from "../services/transaction-payment.service";
import { MercadoPagoService } from "../services/mercadopago.service";
import { db } from "../../init";
import { logger } from "../../lib/logger";

export const createPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const { method, installments, backUrl, transactionId, payerOverride: rawPayerOverride } = req.body as {
      method?: unknown;
      installments?: unknown;
      backUrl?: unknown;
      transactionId?: unknown;
      payerOverride?: unknown;
    };

    const validMethods = ["pix", "credit_card", "debit_card", "boleto"];
    if (!method || typeof method !== "string" || !validMethods.includes(method)) {
      res.status(400).json({ message: "Método de pagamento inválido" });
      return;
    }

    let parsedPayerOverride: {
      identification?: { type: "CPF" | "CNPJ"; number: string };
      firstName?: string;
      lastName?: string;
      address?: {
        zipCode: string;
        streetName: string;
        streetNumber: string;
        neighborhood: string;
        city: string;
        federalUnit: string;
      };
    } | undefined;
    if (rawPayerOverride && typeof rawPayerOverride === "object") {
      const po = rawPayerOverride as Record<string, unknown>;
      const idObj = typeof po.identification === "object" && po.identification !== null
        ? (po.identification as Record<string, unknown>)
        : undefined;
      const idType = idObj?.type === "CPF" || idObj?.type === "CNPJ" ? idObj.type : undefined;
      const idNumber = typeof idObj?.number === "string" ? idObj.number.replace(/\D/g, "").slice(0, 14) : undefined;

      let parsedAddress: { zipCode: string; streetName: string; streetNumber: string; neighborhood: string; city: string; federalUnit: string } | undefined;
      const addrRaw = typeof po.address === "object" && po.address !== null
        ? (po.address as Record<string, unknown>)
        : undefined;
      if (addrRaw) {
        const zipCode = typeof addrRaw.zipCode === "string" ? addrRaw.zipCode.replace(/\D/g, "").slice(0, 8) : "";
        const streetName = typeof addrRaw.streetName === "string" ? addrRaw.streetName.trim().slice(0, 120) : "";
        const streetNumber = typeof addrRaw.streetNumber === "string" ? addrRaw.streetNumber.trim().slice(0, 20) : "";
        const neighborhood = typeof addrRaw.neighborhood === "string" ? addrRaw.neighborhood.trim().slice(0, 80) : "";
        const city = typeof addrRaw.city === "string" ? addrRaw.city.trim().slice(0, 80) : "";
        const federalUnit = typeof addrRaw.federalUnit === "string" ? addrRaw.federalUnit.trim().toUpperCase().slice(0, 2) : "";
        if (zipCode && streetName && streetNumber && neighborhood && city && federalUnit) {
          parsedAddress = { zipCode, streetName, streetNumber, neighborhood, city, federalUnit };
        }
      }

      parsedPayerOverride = {
        identification: idType && idNumber ? { type: idType, number: idNumber } : undefined,
        firstName: typeof po.firstName === "string" ? po.firstName.trim().slice(0, 60) : undefined,
        lastName: typeof po.lastName === "string" ? po.lastName.trim().slice(0, 60) : undefined,
        address: parsedAddress,
      };
    }

    const result = await TransactionPaymentService.createPayment({
      token,
      method: method as "pix" | "credit_card" | "debit_card" | "boleto",
      installments: typeof installments === "number" ? installments : undefined,
      backUrl: typeof backUrl === "string" ? backUrl : undefined,
      transactionId: typeof transactionId === "string" ? transactionId : undefined,
      payerOverride: parsedPayerOverride,
    });

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof MercadoPagoApiError) {
      const mpStatusCode =
        error.mpStatus === 401 || error.mpStatus >= 500 ? 502 : error.mpStatus === 429 ? 429 : 400;
      const code = error.mpStatus === 401 ? "MP_AUTH_FAILED" : "MP_REJECTED";
      const message =
        error.mpStatus === 401
          ? "Integração Mercado Pago precisa ser reconectada"
          : error.mpMessage || "Pagamento recusado pelo Mercado Pago";
      res.status(mpStatusCode).json({
        code,
        message,
        mpStatus: error.mpStatus,
        mpError: { message: error.mpMessage, cause: error.mpCause },
      });
      return;
    }
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
    if (err.message === "FORBIDDEN_CROSS_GROUP") {
      res.status(403).json({ message: "Este lançamento não pertence ao grupo do link compartilhado" });
      return;
    }
    if (err.message === "INVALID_AMOUNT") {
      res.status(400).json({ code: "INVALID_AMOUNT", message: "Valor do lançamento inválido" });
      return;
    }
    if (err.message === "INVALID_IDENTIFICATION") {
      res.status(400).json({ code: "INVALID_IDENTIFICATION", message: "CPF ou CNPJ inválido. Verifique os dados e tente novamente." });
      return;
    }
    if (err.message === "BOLETO_MISSING_IDENTIFICATION") {
      res.status(422).json({ code: "BOLETO_MISSING_IDENTIFICATION", message: "Para gerar boleto, o cliente precisa ter CPF ou CNPJ cadastrado." });
      return;
    }
    if (err.message === "BOLETO_MISSING_ADDRESS") {
      res.status(422).json({ code: "BOLETO_MISSING_ADDRESS", message: "Endereço completo é obrigatório para gerar boleto." });
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

export const getMpConfig = async (req: Request, res: Response): Promise<void> => {
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
    const linkData = snapshot.docs[0].data() as { tenantId: string; expiresAt: string | null };
    if (linkData.expiresAt !== null && new Date(linkData.expiresAt) < new Date()) {
      res.status(410).json({ message: "Link expirado" });
      return;
    }
    const config = await MercadoPagoService.getPublicConfig(linkData.tenantId);
    res.status(200).json(config);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    if (err.message === "MP_NOT_CONFIGURED") {
      res.status(422).json({ message: "Pagamento online não configurado para este tenant" });
      return;
    }
    logger.error("Unexpected error in getMpConfig", { errorMessage: err.message });
    res.status(500).json({ message: err.message });
  }
};

export const processCardPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const body = req.body as {
      cardToken?: unknown;
      paymentMethodId?: unknown;
      issuerId?: unknown;
      installments?: unknown;
      payerEmail?: unknown;
      payerIdentification?: unknown;
      transactionId?: unknown;
    };

    if (!body.cardToken || typeof body.cardToken !== "string") {
      res.status(400).json({ message: "cardToken inválido" });
      return;
    }
    if (!body.paymentMethodId || typeof body.paymentMethodId !== "string") {
      res.status(400).json({ message: "paymentMethodId inválido" });
      return;
    }
    const installments = typeof body.installments === "number" ? body.installments : 1;
    if (typeof body.payerEmail !== "string" || !body.payerEmail.includes("@")) {
      res.status(400).json({ code: "PAYER_EMAIL_REQUIRED", message: "E-mail do pagador é obrigatório." });
      return;
    }
    const payerEmail = body.payerEmail.trim().toLowerCase();

    let payerIdentification: ProcessCardPaymentRequest["payerIdentification"];
    if (
      body.payerIdentification &&
      typeof (body.payerIdentification as Record<string, unknown>).type === "string" &&
      typeof (body.payerIdentification as Record<string, unknown>).number === "string"
    ) {
      const pi = body.payerIdentification as { type: string; number: string };
      if (pi.type === "CPF" || pi.type === "CNPJ") {
        payerIdentification = { type: pi.type, number: pi.number };
      }
    }

    const result = await TransactionPaymentService.processCardPayment({
      token,
      transactionId: typeof body.transactionId === "string" ? body.transactionId : undefined,
      cardToken: body.cardToken,
      paymentMethodId: body.paymentMethodId,
      issuerId: typeof body.issuerId === "string" ? body.issuerId : undefined,
      installments,
      payerEmail,
      payerIdentification,
    });

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof MercadoPagoApiError) {
      const mpStatusCode =
        error.mpStatus === 401 || error.mpStatus >= 500 ? 502 : error.mpStatus === 429 ? 429 : 400;
      const isInvalidUsers =
        error.mpMessage?.toLowerCase().includes("invalid users") ||
        error.mpCause?.some((c) => String(c.code) === "106" || c.description?.toLowerCase().includes("invalid users"));
      const code = error.mpStatus === 401 ? "MP_AUTH_FAILED" : isInvalidUsers ? "MP_INVALID_PAYER" : "MP_REJECTED";
      const message =
        error.mpStatus === 401
          ? "Integração Mercado Pago precisa ser reconectada"
          : isInvalidUsers
            ? "E-mail do pagador inválido. Em ambiente de teste, use qualquer e-mail comum (gmail/hotmail/etc.), diferente do e-mail do vendedor. Não use e-mails @testuser.com."
            : error.mpMessage || "Pagamento recusado pelo Mercado Pago";
      res.status(mpStatusCode).json({
        code,
        message,
        mpStatus: error.mpStatus,
        mpError: { message: error.mpMessage, cause: error.mpCause },
      });
      return;
    }
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
    if (err.message === "FORBIDDEN_CROSS_GROUP") {
      res.status(403).json({ message: "Este lançamento não pertence ao grupo do link compartilhado" });
      return;
    }
    if (err.message === "INVALID_AMOUNT") {
      res.status(400).json({ code: "INVALID_AMOUNT", message: "Valor do lançamento inválido" });
      return;
    }
    logger.error("Unexpected error in processCardPayment", { errorMessage: err.message });
    res.status(500).json({ message: err.message });
  }
};
