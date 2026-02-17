import { db } from "../../init";
import { Timestamp } from "firebase-admin/firestore";
import { PluggyService } from "./pluggy.service";

interface ReconciliationRule {
  id: string;
  tenantId: string;
  keyword: string;
  targetCategory: string;
  targetType?: "income" | "expense";
  isActive: boolean;
}

export class SyncService {
  /**
   * Syncs transactions for a connected account.
   * Can be called by API (manual sync) or Webhook (automated sync).
   * 
   * @param connectedAccountId The internal Firestore ID of the connected account
   * @param userId The ID of the user triggering the sync (optional for webhooks)
   */
  static async syncAccountTransactions(connectedAccountId: string, userId: string = "system") {
    try {
      const docRef = db.collection("connected_accounts").doc(connectedAccountId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        throw new Error("Connected account not found");
      }

      const docData = docSnap.data();
      const tenantId = docData?.tenantId;
      const provider = docData?.provider;
      const providerItemId = docData?.providerItemId;

      if (!tenantId || !provider || !providerItemId) {
        throw new Error("Invalid account data");
      }

      // 1. Fetch Rules
      const rules = await this.fetchReconciliationRules(tenantId);

      // 2. Fetch Transactions from Provider
      const transactions = await this.fetchProviderTransactions(docData?.accessToken, provider, providerItemId);

      // 3. Process and Save
      const batch = db.batch();
      const transactionsRef = db.collection("transactions");
      const now = Timestamp.now();
      let importedCount = 0;

      for (const tx of transactions) {
        // Check for duplicates (Strict External ID)
        const existing = await transactionsRef
          .where("tenantId", "==", tenantId)
          .where("externalId", "==", tx.externalId)
          .limit(1)
          .get();

        if (existing.empty) {
          // Apply Reconciliation Rules (De/Para)
          let category = tx.category || "Outros";
          let type = tx.type;
          const isConciliated = false;
          const conciliatedAt = null;

          // Find matching rule
          const matchedRule = rules.find((rule) => {
             if (!rule.isActive) return false;
             return tx.description.toLowerCase().includes(rule.keyword.toLowerCase());
          });

          if (matchedRule) {
            category = matchedRule.targetCategory;
            if (matchedRule.targetType) {
               type = matchedRule.targetType;
            }
          }

          const newTxRef = transactionsRef.doc();
          batch.set(newTxRef, {
            tenantId,
            type: type,
            description: tx.description,
            rawDescription: tx.description,
            amount: Math.abs(tx.amount),
            date: tx.date,
            status: "paid",
            category: category, 
            externalId: tx.externalId,
            isConciliated: isConciliated,
            conciliatedAt: conciliatedAt,
            connectedAccountId, // Store relationship
            createdAt: now,
            updatedAt: now,
            createdBy: userId,
          });
          importedCount++;
        }
      }

      if (importedCount > 0) {
        await batch.commit();
      }

      // Update last sync
      await docRef.update({ lastSyncAt: now });

      return importedCount;
    } catch (error) {
      console.error(`SyncService Error for account ${connectedAccountId}:`, error);
      throw error;
    }
  }

  private static async fetchReconciliationRules(tenantId: string): Promise<ReconciliationRule[]> {
    const snapshot = await db.collection("reconciliation_rules")
      .where("tenantId", "==", tenantId)
      .where("isActive", "==", true)
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReconciliationRule));
  }

  private static async fetchProviderTransactions(
    accessToken: string,
    provider: string,
    providerItemId: string
  ) {
    if (provider === "pluggy") {
      try {
        // Fetch accounts for the Item first
        const accounts = await PluggyService.getAccounts(providerItemId);
        let allTransactions: any[] = [];
        
        // Fetch transactions for all accounts in the item
        for (const account of accounts) {
           const txs = await PluggyService.getTransactions(account.id);
           allTransactions = [...allTransactions, ...txs];
        }
        
        return allTransactions.map((tx: any) => ({
          externalId: tx.id,
          description: tx.description,
          amount: tx.amount, 
          date: tx.date,
          type: tx.amount < 0 ? "expense" : "income",
          category: tx.category || "Outros",
        }));
      } catch (e) {
        console.error("Error fetching from Pluggy:", e);
        return [];
      }
    }

    // Mock Fallback
    return [
      {
        externalId: `mock-tx-static-1`,
        description: "COMPRA PADARIA MOCK",
        amount: -25.50,
        date: new Date().toISOString(),
        type: "expense",
        category: "Outros",
      },
    ];
  }
}
