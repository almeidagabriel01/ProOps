export const UPDATABLE_TRANSACTION_FIELDS = new Set([
  "type",
  "description",
  "amount",
  "date",
  "dueDate",
  "status",
  "clientId",
  "clientName",
  "proposalId",
  "proposalGroupId",
  "category",
  "wallet",
  "isDownPayment",
  "downPaymentType",
  "downPaymentPercentage",
  "isInstallment",
  "installmentCount",
  "installmentNumber",
  "installmentGroupId",
  "installmentInterval",
  "isRecurring",
  "recurringGroupId",
  "paymentMode",
  "notes",
  "extraCosts",
  "isPartialPayment",
  "parentTransactionId",
]);

export function sanitizeTransactionUpdateData(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  Object.entries(input).forEach(([key, value]) => {
    if (UPDATABLE_TRANSACTION_FIELDS.has(key) && value !== undefined) {
      safe[key] = value;
    }
  });
  return safe;
}

export function roundCurrency(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function toNumber(value: unknown, fallback = 0): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? parseFloat(value)
        : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export function toDateOnly(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) {
    return value.includes("T") ? value.split("T")[0] : value;
  }
  return fallback;
}

export function timestampToMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const asObj = value as {
    toMillis?: () => number;
    seconds?: number;
    nanoseconds?: number;
    _seconds?: number;
    _nanoseconds?: number;
  };
  if (typeof asObj?.toMillis === "function") {
    return asObj.toMillis();
  }
  const sec =
    typeof asObj?.seconds === "number"
      ? asObj.seconds
      : typeof asObj?._seconds === "number"
        ? asObj._seconds
        : undefined;
  const nanos =
    typeof asObj?.nanoseconds === "number"
      ? asObj.nanoseconds
      : typeof asObj?._nanoseconds === "number"
        ? asObj._nanoseconds
        : 0;
  if (typeof sec === "number") {
    return sec * 1000 + Math.floor(nanos / 1_000_000);
  }
  return 0;
}

export function getWalletImpacts(data: Record<string, any>): Map<string, number> {
  const impacts = new Map<string, number>();
  if (!data) return impacts;

  const type = data.type; // "income" or "expense"
  const sign = type === "income" ? 1 : -1;

  const addImpact = (wallet: string | null | undefined, amount: number) => {
    if (!wallet || amount === 0) return;
    impacts.set(wallet, (impacts.get(wallet) || 0) + amount);
  };

  // Main transaction impact
  if (data.status === "paid" && data.wallet) {
    addImpact(data.wallet, sign * (toNumber(data.amount, 0) || 0));
  }

  // Extra Costs impact (add to parent transaction value)
  if (data.extraCosts && Array.isArray(data.extraCosts)) {
    for (const ec of data.extraCosts) {
      if (ec.status === "paid" && (ec.wallet || data.wallet)) {
        addImpact(
          ec.wallet || data.wallet,
          sign * (toNumber(ec.amount, 0) || 0),
        );
      }
    }
  }

  return impacts;
}

export function syncExtraCostsStatus(
  extraCosts: unknown,
  newStatus: "paid" | "pending" | "overdue",
  oldParentStatus?: string,
): Record<string, any>[] | undefined {
  if (!Array.isArray(extraCosts)) return undefined;

  return extraCosts.map((ec) => {
    const ecData = ec as Record<string, any>;
    // Only sync extra costs that were aligned with the old parent status
    // (or had no status set). Leave independently-set statuses untouched.
    if (oldParentStatus && ecData.status && ecData.status !== oldParentStatus) {
      return ecData;
    }
    return { ...ecData, status: newStatus };
  });
}

export function isDownPaymentLikeDoc(data: Record<string, any>): boolean {
  return !!data?.isDownPayment || toNumber(data?.installmentNumber, -1) === 0;
}

export function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function addDateMonths(dateStr: string, months: number): string {
  if (months === 0) return dateStr;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const totalMonths = year * 12 + month + months;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = totalMonths % 12;
  const daysInNewMonth = new Date(newYear, newMonth + 1, 0).getDate();
  const newDay = Math.min(day, daysInNewMonth);
  return `${newYear.toString().padStart(4, "0")}-${(newMonth + 1).toString().padStart(2, "0")}-${newDay.toString().padStart(2, "0")}`;
}
