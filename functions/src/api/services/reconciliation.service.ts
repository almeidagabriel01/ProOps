
import { db } from "../../init";

export class ReconciliationService {
  /**
   * Applies active reconciliation rules to a transaction or transaction data.
   * Mutates the transaction object and returns it.
   */
  static async applyRules(tenantId: string, transaction: any) {
    try {
      // 1. Fetch active rules for this tenant
      // Optimization: In a real app, caching these rules would be better.
      const rulesSnap = await db.collection("reconciliation_rules")
        .where("tenantId", "==", tenantId)
        .where("isActive", "==", true)
        .get();

      if (rulesSnap.empty) return transaction;

      const rules = rulesSnap.docs.map((doc) => doc.data());

      // 2. Iterate and apply logic
      // Priority: First matching rule wins.
      for (const rule of rules) {
        if (!rule.keyword || !rule.targetCategory) continue;

        const keyword = rule.keyword.toLowerCase();
        const description = (transaction.description || "").toLowerCase();
        // Check rawDescription if available (Open Finance usually provides this)
        const rawDescription = (transaction.rawDescription || "").toLowerCase();

        if (description.includes(keyword) || rawDescription.includes(keyword)) {
          // Match found!
          // Apply category
          transaction.category = rule.targetCategory;
          
          // Apply type if specified (income/expense)
          if (rule.targetType) {
            transaction.type = rule.targetType;
          }

          // Mark as auto-conciliated? Maybe not yet, just categorized.
          // But usually categorization IS the conciliation step for us.
          // transaction.isConciliated = true; // Optional logic

          break; // Stop after first match
        }
      }

      return transaction;
    } catch (error) {
      console.error("Error applying reconciliation rules:", error);
      // Return original transaction on error to avoid blocking creation
      return transaction;
    }
  }
}
