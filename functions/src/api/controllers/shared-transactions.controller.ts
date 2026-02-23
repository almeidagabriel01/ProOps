import { Request, Response } from "express";
import { SharedTransactionService } from "../services/shared-transactions.service";
import { resolveUserAndTenant } from "../../lib/auth-helpers";
import { db } from "../../init";

/**
 * POST /v1/transactions/:id/share-link
 * Gera um link compartilhável para um lançamento financeiro
 */
export const createShareLink = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id: transactionId } = req.params;

    if (!transactionId) {
      return res.status(400).json({ message: "ID do lançamento é obrigatório" });
    }

    // Resolver tenant do usuário
    const { tenantId, isSuperAdmin } = await resolveUserAndTenant(
      userId,
      req.user,
    );

    // Buscar lançamento
    const transactionRef = db.collection("transactions").doc(transactionId);
    const transactionSnap = await transactionRef.get();

    if (!transactionSnap.exists) {
      return res.status(404).json({ message: "Lançamento não encontrado" });
    }

    const transactionData = transactionSnap.data();

    // Validar acesso (lançamento deve pertencer ao tenant do usuário)
    if (!isSuperAdmin && transactionData?.tenantId !== tenantId) {
      return res.status(403).json({ message: "Acesso negado" });
    }

    // Gerar link compartilhável
    const result = await SharedTransactionService.createShareLink(
      transactionId,
      transactionData?.tenantId || tenantId,
      userId,
    );

    return res.status(201).json({
      success: true,
      ...result,
      message: "Link compartilhável gerado com sucesso",
    });
  } catch (error) {
    console.error("Error creating share link:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao gerar link";
    return res.status(500).json({ message });
  }
};

/**
 * GET /v1/share/transaction/:token
 * Acessa um lançamento via link público (sem autenticação)
 */
export const getSharedTransaction = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ message: "Token inválido" });
    }

    // Buscar lançamento compartilhado
    const sharedTransaction = await SharedTransactionService.getSharedTransaction(token);

    if (!sharedTransaction) {
      return res
        .status(404)
        .json({ message: "Link não encontrado ou inválido" });
    }

    // Buscar dados do lançamento
    const transactionRef = db
      .collection("transactions")
      .doc(sharedTransaction.transactionId);
    const transactionSnap = await transactionRef.get();

    if (!transactionSnap.exists) {
      return res.status(404).json({ message: "Lançamento não encontrado" });
    }

    const transactionData = transactionSnap.data();

    let relatedTransactions: any[] = [];
    if (transactionData?.proposalGroupId) {
       const relatedSnap = await db.collection("transactions")
         .where("proposalGroupId", "==", transactionData.proposalGroupId)
         .where("tenantId", "==", sharedTransaction.tenantId)
         .get();
       relatedTransactions = relatedSnap.docs.map(d => ({id: d.id, ...d.data()}));
    } else if (transactionData?.installmentGroupId) {
       const relatedSnap = await db.collection("transactions")
         .where("installmentGroupId", "==", transactionData.installmentGroupId)
         .where("tenantId", "==", sharedTransaction.tenantId)
         .get();
       relatedTransactions = relatedSnap.docs.map(d => ({id: d.id, ...d.data()}));
    }

    // Buscar dados do tenant para branding
    const tenantRef = db.collection("tenants").doc(sharedTransaction.tenantId);
    const tenantSnap = await tenantRef.get();
    const tenantData = tenantSnap.exists ? tenantSnap.data() : null;

    // Registrar visualização
    const viewerData = {
      ip: req.ip || (req.headers["x-forwarded-for"] as string),
      userAgent: req.headers["user-agent"],
    };

    await SharedTransactionService.recordView(
      sharedTransaction.id,
      viewerData,
    );

    // Retornar dados da proposta
    return res.status(200).json({
      success: true,
      transaction: {
        id: transactionSnap.id,
        ...transactionData,
      },
      relatedTransactions,
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
        message: "Este link expirou. Solicite um novo link ao responsável.",
        code: "EXPIRED_LINK",
      });
    }

    const message =
      error instanceof Error ? error.message : "Erro ao carregar lançamento";
    return res.status(500).json({ message });
  }
};
