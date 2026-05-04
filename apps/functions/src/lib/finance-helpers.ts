import { db } from "../init";
import { UserDoc } from "./auth-helpers";

function normalizeRole(value: unknown): string {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeTenantId(value: unknown): string {
  return String(value || "").trim();
}

export interface WalletDoc {
  name: string;
  balance: number;
  tenantId: string;
}

/**
 * Add months to a date string (YYYY-MM-DD format).
 * Handles timezone-safe parsing by manually extracting year/month/day.
 */
export function addMonths(dateStr: string, months: number): string {
  // Parse the date manually to avoid timezone issues
  // Format expected: YYYY-MM-DD
  const parts = dateStr.split("-");
  if (parts.length !== 3) {
    // Fallback: try ISO format
    if (dateStr.includes("T")) {
      return addMonths(dateStr.split("T")[0], months);
    }
    console.error("Invalid date format for addMonths:", dateStr);
    return dateStr;
  }

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
  const day = parseInt(parts[2], 10);

  // Calculate new month and year
  const totalMonths = year * 12 + month + months;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = totalMonths % 12;

  // Handle edge case: if original day is 31 but new month has less days
  const daysInNewMonth = new Date(newYear, newMonth + 1, 0).getDate();
  const newDay = Math.min(day, daysInNewMonth);

  // Format back to YYYY-MM-DD
  const yearStr = newYear.toString().padStart(4, "0");
  const monthStr = (newMonth + 1).toString().padStart(2, "0");
  const dayStr = newDay.toString().padStart(2, "0");

  return `${yearStr}-${monthStr}-${dayStr}`;
}

export async function resolveWalletRef(
  transaction: FirebaseFirestore.Transaction,
  db: FirebaseFirestore.Firestore,
  tenantId: string,
  identifier: string,
): Promise<{
  ref: FirebaseFirestore.DocumentReference;
  data: WalletDoc;
} | null> {
  if (!identifier) return null;

  // 1. Try as ID
  const directRef = db.collection("wallets").doc(identifier);
  const directSnap = await transaction.get(directRef);

  if (directSnap.exists) {
    const data = directSnap.data() as WalletDoc;
    if (data.tenantId === tenantId) {
      return { ref: directRef, data };
    }
  }

  // 2. Try as Name
  const nameQuery = db
    .collection("wallets")
    .where("tenantId", "==", tenantId)
    .where("name", "==", identifier)
    .limit(1);

  const querySnap = await transaction.get(nameQuery);

  if (!querySnap.empty) {
    const doc = querySnap.docs[0];
    return { ref: doc.ref, data: doc.data() as WalletDoc };
  }

  return null;
}

export async function checkFinancialPermission(
  userId: string,
  permission: string,
  claims?: { uid?: string; role?: string; tenantId?: string; [key: string]: unknown },
): Promise<{
  userDoc?: UserDoc;
  tenantId: string;
  isMaster: boolean;
  isSuperAdmin: boolean;
}> {
  if (!claims?.uid || claims.uid !== userId) {
    throw new Error("UNAUTHENTICATED");
  }

  const role = normalizeRole(claims.role);
  if (!role) throw new Error("AUTH_CLAIMS_MISSING_ROLE");

  const isSuperAdmin = role === "SUPERADMIN";
  const tenantId = normalizeTenantId(claims.tenantId);

  if (!isSuperAdmin && !tenantId) {
    throw new Error("AUTH_CLAIMS_MISSING_TENANT");
  }

  const userRef = db.collection("users").doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new Error("Usuário não encontrado.");
  const userDoc = userSnap.data() as UserDoc;

  const docTenantId = normalizeTenantId(userDoc.tenantId || userDoc.companyId);
  if (tenantId && docTenantId && tenantId !== docTenantId) {
    throw new Error("FORBIDDEN_TENANT_MISMATCH");
  }

  const effectiveTenantId = tenantId || docTenantId;
  if (!isSuperAdmin && !effectiveTenantId) {
    throw new Error("AUTH_CLAIMS_MISSING_TENANT");
  }

  // Check master logic using role claims only.
  const isMaster = role === "MASTER" || role === "ADMIN" || role === "WK";

  if (isSuperAdmin)
    return {
      userDoc,
      tenantId: effectiveTenantId,
      isMaster: true,
      isSuperAdmin: true,
    };
  if (isMaster)
    return {
      userDoc,
      tenantId: effectiveTenantId,
      isMaster: true,
      isSuperAdmin: false,
    };

  // Member check - Needs Permissions Doc
  const permRef = userRef.collection("permissions").doc("financial");
  const permSnap = await permRef.get();

  if (!permSnap.exists || !permSnap.data()?.[permission]) {
    throw new Error("Sem permissão financeira.");
  }

  return {
    userDoc,
    tenantId: effectiveTenantId,
    isMaster: false,
    isSuperAdmin: false,
  };
}
