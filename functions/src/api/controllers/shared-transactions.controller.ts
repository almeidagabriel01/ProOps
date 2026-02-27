import { Request, Response } from "express";
import { SharedTransactionService } from "../services/shared-transactions.service";
import { resolveUserAndTenant } from "../../lib/auth-helpers";
import { db } from "../../init";

// Campos internos de infraestrutura que nunca devem ser expostos em rotas públicas.
const INTERNAL_TRANSACTION_FIELDS = new Set([
  "pdfPath",
  "pdfUrl",
  "storagePath",
  "pdfGenerationLock",
]);

/**
 * Remove campos internos sensíveis antes de responder em rotas públicas.
 * Evita enumeração de paths internos do Firebase Storage e metadados de lock.
 */
function sanitizeSharedTransactionPayload(
  id: string,
  data: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const safe: Record<string, unknown> = { id };
  for (const [key, value] of Object.entries(data || {})) {
    if (!INTERNAL_TRANSACTION_FIELDS.has(key)) {
      safe[key] = value;
    }
  }
  return safe;
}

export const createShareLink = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id: transactionId } = req.params;

    if (!transactionId) {
      return res.status(400).json({ message: "ID do lancamento e obrigatorio" });
    }

    const { tenantId, isSuperAdmin } = await resolveUserAndTenant(userId, req.user);

    const transactionRef = db.collection("transactions").doc(transactionId);
    const transactionSnap = await transactionRef.get();

    if (!transactionSnap.exists) {
      return res.status(404).json({ message: "Lancamento nao encontrado" });
    }

    const transactionData = transactionSnap.data() as
      | { tenantId?: string }
      | undefined;
    const transactionTenantId = String(transactionData?.tenantId || "").trim();
    if (!transactionTenantId) {
      return res.status(412).json({ message: "Lancamento sem tenantId valido" });
    }

    if (!isSuperAdmin && transactionTenantId !== tenantId) {
      return res.status(403).json({ message: "Acesso negado" });
    }

    const result = await SharedTransactionService.createShareLink(
      transactionId,
      transactionTenantId,
      userId,
    );

    return res.status(201).json({
      success: true,
      ...result,
      message: "Link compartilhavel gerado com sucesso",
    });
  } catch (error) {
    console.error("Error creating shared transaction link:", error);
    const message = error instanceof Error ? error.message : "Erro ao gerar link";
    return res.status(500).json({ message });
  }
};

export const getSharedTransaction = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const isPdfGeneratorRequest = req.headers["x-pdf-generator"] === "true";

    if (!token) {
      return res.status(400).json({ message: "Token invalido" });
    }

    const sharedTransaction = await SharedTransactionService.getSharedTransaction(token);

    if (!sharedTransaction) {
      return res.status(404).json({ message: "Link nao encontrado ou invalido" });
    }

    const transactionRef = db.collection("transactions").doc(sharedTransaction.transactionId);
    const transactionSnap = await transactionRef.get();

    if (!transactionSnap.exists) {
      return res.status(404).json({ message: "Lancamento nao encontrado" });
    }

    const transactionData = transactionSnap.data() as
      | {
          tenantId?: string;
          proposalGroupId?: string;
          installmentGroupId?: string;
        }
      | undefined;

    const transactionTenantId = String(transactionData?.tenantId || "").trim();
    if (!transactionTenantId || transactionTenantId !== sharedTransaction.tenantId) {
      return res.status(404).json({ message: "Lancamento nao encontrado" });
    }

    let relatedTransactions: Array<Record<string, unknown>> = [];
    if (transactionData?.proposalGroupId) {
      const relatedSnap = await db
        .collection("transactions")
        .where("proposalGroupId", "==", transactionData.proposalGroupId)
        .where("tenantId", "==", sharedTransaction.tenantId)
        .get();
      relatedTransactions = relatedSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
    } else if (transactionData?.installmentGroupId) {
      const relatedSnap = await db
        .collection("transactions")
        .where("installmentGroupId", "==", transactionData.installmentGroupId)
        .where("tenantId", "==", sharedTransaction.tenantId)
        .get();
      relatedTransactions = relatedSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
    }

    const tenantRef = db.collection("tenants").doc(sharedTransaction.tenantId);
    const tenantSnap = await tenantRef.get();
    const tenantData = tenantSnap.exists ? tenantSnap.data() : null;

    if (!isPdfGeneratorRequest) {
      const viewerData = {
        ip: req.ip || (req.headers["x-forwarded-for"] as string),
        userAgent: req.headers["user-agent"],
      };

      void SharedTransactionService.recordView(
        sharedTransaction.id,
        sharedTransaction.tenantId,
        sharedTransaction.transactionId,
        viewerData,
        (transactionData as Record<string, unknown>)?.description as
          | string
          | undefined,
      ).catch((recordError) => {
        console.error("recordView failed (non-critical)", recordError);
      });
    }

    return res.status(200).json({
      success: true,
      transaction: sanitizeSharedTransactionPayload(transactionSnap.id, transactionData),
      relatedTransactions: relatedTransactions.map((t) =>
        sanitizeSharedTransactionPayload(String(t.id || ""), t as Record<string, unknown>),
      ),
      tenant: tenantData
        ? {
            id: sharedTransaction.tenantId,
            name: tenantData.name,
            logoUrl: tenantData.logoUrl,
            primaryColor: tenantData.primaryColor,
          }
        : null,
    });
  } catch (error) {
    console.error("Error getting shared transaction:", error);

    if (error instanceof Error && error.message === "EXPIRED_LINK") {
      return res.status(410).json({
        message: "Este link expirou. Solicite um novo link ao responsavel.",
        code: "EXPIRED_LINK",
      });
    }

    const message = error instanceof Error ? error.message : "Erro ao carregar lancamento";
    return res.status(500).json({ message });
  }
};
