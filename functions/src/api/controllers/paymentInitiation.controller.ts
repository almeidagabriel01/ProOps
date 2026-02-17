import { Request, Response } from "express";
import { db } from "../../init";
import { checkFinancialPermission } from "../../lib/finance-helpers";
import { Timestamp } from "firebase-admin/firestore";

// Mock PIS Provider Service
const initiateProviderPayment = async (
  _sourceAccountId: string,
  _pixKey: string,
  _amount: number
) => {
  // In real life, call Pluggy/Belvo/Celcoin PIS API here
  // Return the "Deep Link" or "Auth URL" for the user to approve in their bank app
  return {
    authorizationUrl: activeProviderMockUrl(),
    paymentId: `mock-pis-${Date.now()}`,
    status: "PENDING_AUTHORIZATION",
  };
};

const activeProviderMockUrl = () => {
    // This would be a deep link to the bank app or a web redirect
    // For testing, we can return a success URL or a standard dummy URL
    return "https://mock-bank.com/authorize-payment?id=123";
}

export const initiatePayment = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { transactionId, sourceAccountId, pixKey } = req.body;

    if (!transactionId || !sourceAccountId || !pixKey) {
      return res.status(400).json({ message: "Dados incompletos para pagamento." });
    }

    // 1. Permission Check
    const { tenantId, isSuperAdmin } = await checkFinancialPermission(
      userId,
      "canEdit", // Paying requires edit permission on finance
      req.user
    );

    // 2. Validate Transaction
    const txRef = db.collection("transactions").doc(transactionId);
    const txSnap = await txRef.get();

    if (!txSnap.exists) {
      return res.status(404).json({ message: "Transação não encontrada." });
    }
    const txData = txSnap.data();

    if (!isSuperAdmin && txData?.tenantId !== tenantId) {
      return res.status(403).json({ message: "Acesso negado." });
    }

    if (txData?.status === "paid") {
      return res.status(400).json({ message: "Esta transação já está paga." });
    }

    // 3. Initiate Payment with Provider
    const providerResponse = await initiateProviderPayment(
      sourceAccountId,
      pixKey,
      txData?.amount || 0
    );

    // 4. Record Payment Attempt (Optional: Create a separate 'payment_attempts' collection)
    // For now, we just return the URL to the frontend.
    // In a real app, you'd save the `providerResponse.paymentId` in the transaction 
    // to track status later (Webhook).
    
    await txRef.update({
        paymentInitiationId: providerResponse.paymentId,
        paymentStatus: "processing", // Custom field to track PIS status
        pixKey: pixKey, // Store used key for reference
        updatedAt: Timestamp.now()
    });

    return res.json({
      success: true,
      authorizationUrl: providerResponse.authorizationUrl,
      paymentId: providerResponse.paymentId,
      message: "Pagamento iniciado. Redirecione o usuário.",
    });

  } catch (error: unknown) {
    console.error("Payment Initiation Error:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ message });
  }
};
