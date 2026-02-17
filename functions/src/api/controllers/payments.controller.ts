import { Request, Response } from "express";
import { db } from "../../init";
import { Timestamp } from "firebase-admin/firestore";
import { PluggyService } from "../services/pluggy.service";

export const initiatePayment = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { amount, description, receiver, callbackUrl } = req.body;

    if (!amount || !description || !receiver) {
        return res.status(400).json({ message: "Dados incompletos para pagamento." });
    }

    // 1. Create Payment Request in Pluggy
    const paymentResponse = await PluggyService.createPaymentRequest({
        amount,
        description,
        receiver,
        callbackUrl
    });

    if (!paymentResponse?.paymentUrl) {
        throw new Error("Falha ao gerar URL de pagamento.");
    }

    // 2. Save Transaction as 'Pending' in Firestore
    const transactionsRef = db.collection("transactions");
    const newTxRef = transactionsRef.doc();
    const now = Timestamp.now();
    
    // Safety check for tenantId
    const tenantId = (req.user as any).token?.tenantId || "default-tenant";

    const transactionData = {
        tenantId,
        type: "expense",
        description: description,
        rawDescription: `PIS: ${description}`,
        amount: Math.abs(amount),
        date: new Date().toISOString().split('T')[0],
        status: "pending",
        paymentStatus: paymentResponse.status, // "CREATED"
        paymentInitiationId: paymentResponse.id,
        category: "Pagamentos", 
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
    };

    await newTxRef.set(transactionData);

    return res.status(201).json({
      success: true,
      paymentUrl: paymentResponse.paymentUrl,
      paymentId: paymentResponse.id,
      transactionId: newTxRef.id,
      message: "Pagamento iniciado. Redirecionando...",
    });

  } catch (error: unknown) {
    console.error("initiatePayment Error:", error);
    const message = error instanceof Error ? error.message : "Erro ao iniciar pagamento.";
    return res.status(500).json({ message });
  }
};
