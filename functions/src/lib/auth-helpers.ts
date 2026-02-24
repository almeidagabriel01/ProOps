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

function normalizeRole(value: unknown): string {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeTenantId(value: unknown): string {
  return String(value || "").trim();
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
  userId: string,
  claims?: {
    uid?: string;
    role?: string;
    tenantId?: string;
    masterId?: string;
    [key: string]: unknown;
  },
): Promise<PermissionCheckResult> => {
  if (!claims?.uid || claims.uid !== userId) {
    throw new Error("UNAUTHENTICATED");
  }

  const claimRole = normalizeRole(claims.role);
  if (!claimRole) {
    throw new Error("AUTH_CLAIMS_MISSING_ROLE");
  }

  const isSuperAdmin = claimRole === "SUPERADMIN";
  const isMaster =
    claimRole === "MASTER" || claimRole === "ADMIN" || claimRole === "WK";

  const claimTenantId = normalizeTenantId(claims.tenantId);
  if (!isSuperAdmin && !claimTenantId) {
    throw new Error("AUTH_CLAIMS_MISSING_TENANT");
  }

  const userRef = db.collection("users").doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new Error("User not found");
  const userData = userSnap.data() as UserDoc;

  const docTenantId = normalizeTenantId(userData.tenantId || userData.companyId);
  if (claimTenantId && docTenantId && claimTenantId !== docTenantId) {
    throw new Error("FORBIDDEN_TENANT_MISMATCH");
  }

  const tenantId = claimTenantId || docTenantId;
  if (!tenantId && !isSuperAdmin) {
    throw new Error("AUTH_CLAIMS_MISSING_TENANT");
  }

  let masterRef: FirebaseFirestore.DocumentReference;
  let masterData: UserDoc;

  if (isMaster || isSuperAdmin) {
    masterRef = userRef;
    masterData = userData;
  } else {
    const masterId =
      String(claims.masterId || "").trim() ||
      userData.masterId ||
      userData.masterID ||
      userData.ownerId;

    if (!masterId) {
      throw new Error("Member has no masterId");
    }

    masterRef = db.collection("users").doc(masterId);
    const masterSnap = await masterRef.get();
    if (!masterSnap.exists) throw new Error("Master account not found");
    masterData = masterSnap.data() as UserDoc;

    const masterTenantId = normalizeTenantId(
      masterData.tenantId || masterData.companyId,
    );
    if (tenantId && masterTenantId && tenantId !== masterTenantId) {
      throw new Error("FORBIDDEN_TENANT_MISMATCH");
    }
  }

  return {
    userRef,
    userData,
    masterRef,
    masterData,
    tenantId: tenantId || "",
    isMaster,
    isSuperAdmin,
  };
};

export const checkPermission = async (
  userId: string,
  permissionDoc: string, // e.g., 'products'
  requiredField: string, // e.g., 'canCreate'
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
