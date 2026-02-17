import { Request, Response } from "express";
import { db } from "../../init";
import { Timestamp } from "firebase-admin/firestore";
import { SyncService } from "../services/sync.service";

export const handleOpenFinanceWebhook = async (req: Request, res: Response) => {
  try {
    const { event, data } = req.body;

    console.log(`Webhook received: ${event}`, data);

    if (!event || !data) {
      return res.status(400).json({ message: "Invalid payload." });
    }

    // --- PAYMENT WEBHOOKS ---
    if (event === "PAYMENT_UPDATED") {
      const { paymentId, status } = data;

      // Find transaction by paymentInitiationId
      const snapshot = await db
        .collection("transactions")
        .where("paymentInitiationId", "==", paymentId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        console.warn(`Transaction not found for paymentId: ${paymentId}`);
        return res.status(404).json({ message: "Transaction not found." });
      }

      const doc = snapshot.docs[0];
      const transactionData = doc.data();

      // Map provider status to internal status
      let newStatus = transactionData.status; // Keep current if unknown
      if (status === "COMPLETED" || status === "SUCCEEDED") {
        newStatus = "paid";
      } else if (status === "FAILED" || status === "REJECTED") {
        console.log(`Payment failed for ${paymentId}`);
      }

      if (newStatus !== transactionData.status) {
        await doc.ref.update({
          status: newStatus,
          paymentStatus: status, // Update raw status
          updatedAt: Timestamp.now(),
        });
        console.log(`Transaction ${doc.id} updated to ${newStatus}`);
      }
      return res.json({ success: true, message: "Payment webhook processed." });
    }

    // --- PLUGGY WEBHOOKS ---
    if (event === "TRANSACTION_CREATED") {
       console.log("Processing Pluggy Transaction Webhook", data);
       
       const { itemId } = req.body; 

       if (!itemId) {
          return res.status(400).json({ message: "Missing itemId" });
       }

       // 1. Find the connected account
       const accountsSnapshot = await db.collection("connected_accounts")
         .where("providerItemId", "==", itemId)
         .limit(1)
         .get();

       if (accountsSnapshot.empty) {
          console.warn(`Connected Account not found for Item ID ${itemId}`);
          return res.status(200).json({ message: "Account not found, skipping." });
       }
       
       const connectedAccountDoc = accountsSnapshot.docs[0];
       
       // 2. Trigger Sync
       console.log(`Triggering sync for account ${connectedAccountDoc.id}`);
       
       await SyncService.syncAccountTransactions(connectedAccountDoc.id);
       
       return res.json({ success: true, message: "Transaction webhook processed." });
    }

    return res.json({ success: true, message: "Webhook processed (ignoring unknown event)." });
  } catch (error: unknown) {
    console.error("Webhook Error:", error);
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ message });
  }
};
