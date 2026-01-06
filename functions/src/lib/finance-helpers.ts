import { db } from "../init";
import { UserDoc } from "./auth-helpers";

export interface WalletDoc {
  name: string;
  balance: number;
  tenantId: string;
}

export function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  const targetMonth = d.getMonth() + months;
  const yearDiff = Math.floor(targetMonth / 12);
  const month = targetMonth % 12;
  const day = d.getDate();

  const newDate = new Date(d.getFullYear() + yearDiff, month, 1);
  const daysInMonth = new Date(
    d.getFullYear() + yearDiff,
    month + 1,
    0
  ).getDate();
  newDate.setDate(Math.min(day, daysInMonth));

  return newDate.toISOString().split("T")[0];
}

export async function resolveWalletRef(
  transaction: FirebaseFirestore.Transaction,
  db: FirebaseFirestore.Firestore,
  tenantId: string,
  identifier: string
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
  permission: string
): Promise<{
  userDoc: UserDoc;
  tenantId: string;
  isMaster: boolean;
  isSuperAdmin: boolean;
}> {
  const userRef = db.collection("users").doc(userId);
  const permRef = userRef.collection("permissions").doc("financial");

  const [userSnap, permSnap] = await Promise.all([
    userRef.get(),
    permRef.get(),
  ]);

  if (!userSnap.exists) throw new Error("Usuário não encontrado.");

  const userDoc = userSnap.data() as UserDoc;
  const role = (userDoc.role || "").toUpperCase();
  const isSuperAdmin = role === "SUPERADMIN";
  const tenantId = userDoc.tenantId || userDoc.companyId;

  if (!tenantId && !isSuperAdmin) throw new Error("Usuário sem tenantId.");

  const isMaster =
    role === "MASTER" ||
    role === "ADMIN" ||
    role === "WK" ||
    (!userDoc.masterId && !userDoc.masterID && !!userDoc.subscription);

  if (isSuperAdmin)
    return { userDoc, tenantId: tenantId!, isMaster: true, isSuperAdmin: true };
  if (isMaster)
    return {
      userDoc,
      tenantId: tenantId!,
      isMaster: true,
      isSuperAdmin: false,
    };

  // Member check
  if (!permSnap.exists || !permSnap.data()?.[permission]) {
    throw new Error("Sem permissão financeira.");
  }

  return { userDoc, tenantId: tenantId!, isMaster: false, isSuperAdmin: false };
}
