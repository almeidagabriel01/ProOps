import type { ExtraCost, Transaction } from "@/services/transaction-service";

export type DateLike =
  | string
  | Date
  | { toDate: () => Date }
  | { toMillis: () => number }
  | { seconds: number }
  | null
  | undefined;

export const isDownPaymentLike = (t: Transaction): boolean =>
  !!t.isDownPayment || (t.installmentNumber || 0) === 0;

export const dateOnly = (value?: string): string => {
  if (!value) return "";
  return value.includes("T") ? value.split("T")[0] : value;
};

export const sameClient = (a: Transaction, b: Transaction): boolean => {
  const aClientId = a.clientId || "";
  const bClientId = b.clientId || "";
  if (aClientId && bClientId) return aClientId === bClientId;
  return (a.clientName || "").trim() === (b.clientName || "").trim();
};

export const baseDesc = (s: string): string =>
  s.replace(/\s*\(\d+\/\d+\)\s*$/, "").trim();

export type AggregatedExtraCost = ExtraCost & {
  parentTransactionId: string;
};

export const getTransactionExtraCosts = (
  transaction: Transaction,
): AggregatedExtraCost[] =>
  (transaction.extraCosts || []).map((ec) => ({
    ...ec,
    parentTransactionId: ec.parentTransactionId || transaction.id,
  }));

export const aggregateExtraCosts = (
  groupTransactions: Transaction[],
): AggregatedExtraCost[] => {
  const extraCostsById = new Map<string, AggregatedExtraCost>();

  groupTransactions.forEach((groupTransaction) => {
    getTransactionExtraCosts(groupTransaction).forEach((extraCost) => {
      extraCostsById.set(extraCost.id, extraCost);
    });
  });

  return Array.from(extraCostsById.values()).sort((a, b) => {
    const aTime = Date.parse(a.createdAt || "");
    const bTime = Date.parse(b.createdAt || "");
    const safeATime = Number.isFinite(aTime) ? aTime : 0;
    const safeBTime = Number.isFinite(bTime) ? bTime : 0;
    return safeBTime - safeATime;
  });
};

export const getGroupedTransactionKey = (transaction: Transaction): string => {
  if (transaction.proposalGroupId) {
    return `proposal:${transaction.proposalGroupId}`;
  }
  const groupId = transaction.installmentGroupId || transaction.recurringGroupId;
  if (groupId) {
    return `group:${groupId}`;
  }
  return `transaction:${transaction.id}`;
};

// Helper to get YYYY-MM-DD string in Local Time matching user perception
export function getDateString(val: DateLike): string {
  if (!val) return "";

  // If it's a string, handle it carefully to avoid timezone issues
  if (typeof val === "string") {
    // If it's just a date (YYYY-MM-DD), return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      return val;
    }
    // If it has a time component (ISO format), extract just the date part
    // This avoids timezone conversion issues
    if (val.includes("T")) {
      return val.split("T")[0];
    }
    // For other string formats, try to parse and convert
    // Parse as local date to avoid timezone shift
    const parts = val.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (parts) {
      return `${parts[1]}-${parts[2]}-${parts[3]}`;
    }
    // Fallback: try parsing as date
    const date = new Date(val + "T12:00:00"); // Add noon time to avoid day boundary issues
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    return "";
  }

  let date: Date;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = val as any;
  if (typeof v?.toDate === "function") date = v.toDate();
  else if (v?.seconds) date = new Date(v.seconds * 1000);
  else date = new Date(v);

  if (isNaN(date.getTime())) return "";

  // Use local component methods to ensure it matches what user sees on screen
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
