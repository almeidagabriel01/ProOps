import { db } from "../init";

export interface UserDoc {
  role: string;
  name?: string;
  masterId?: string | null;
  masterID?: string | null;
  ownerId?: string | null;
  tenantId?: string;
  companyId?: string;
  planId?: string;
  companyName?: string;
  subscription?: {
    limits: {
      maxProducts: number;
      maxClients?: number;
      maxUsers?: number;
      maxProposals?: number;
    };
    status: string;
  };
  usage?: {
    products: number;
    clients?: number;
    users?: number;
    proposals?: number;
  };
}

export interface PermissionCheckResult {
  userRef: FirebaseFirestore.DocumentReference;
  userData: UserDoc;
  masterRef: FirebaseFirestore.DocumentReference;
  masterData: UserDoc;
  tenantId: string;
  isMaster: boolean;
  isSuperAdmin: boolean;
}

export const resolveUserAndTenant = async (
  userId: string
): Promise<PermissionCheckResult> => {
  const userRef = db.collection("users").doc(userId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw new Error("User not found");
  }

  const userData = userSnap.data() as UserDoc;
  const role = (userData.role || "").toUpperCase();
  const isSuperAdmin = role === "SUPERADMIN";

  // Legacy support for tenantId/companyId
  const tenantId = userData.tenantId || userData.companyId;

  if (!tenantId && !isSuperAdmin) {
    throw new Error("User has no tenantId/companyId");
  }

  const isMaster =
    role === "MASTER" ||
    role === "ADMIN" ||
    role === "WK" ||
    (!userData.masterId && !userData.masterID && !!userData.subscription);

  let masterRef: FirebaseFirestore.DocumentReference;
  let masterData: UserDoc;

  if (isMaster || isSuperAdmin) {
    masterRef = userRef;
    masterData = userData;
  } else {
    // Member - fetch master
    const masterId = userData.masterId || userData.masterID || userData.ownerId;
    if (!masterId) {
      throw new Error("Member has no masterId");
    }
    masterRef = db.collection("users").doc(masterId);
    const masterSnap = await masterRef.get();
    if (!masterSnap.exists) {
      throw new Error("Master account not found");
    }
    masterData = masterSnap.data() as UserDoc;
  }

  return {
    userRef,
    userData,
    masterRef,
    masterData,
    tenantId: tenantId!,
    isMaster,
    isSuperAdmin,
  };
};

export const checkPermission = async (
  userId: string,
  permissionDoc: string, // e.g., 'products'
  requiredField: string // e.g., 'canCreate'
): Promise<boolean> => {
  const permRef = db
    .collection("users")
    .doc(userId)
    .collection("permissions")
    .doc(permissionDoc);
  const permSnap = await permRef.get();

  if (!permSnap.exists) return false;
  return permSnap.data()?.[requiredField] === true;
};
