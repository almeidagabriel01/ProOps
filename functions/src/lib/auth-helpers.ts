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
  userId: string,
  claims?: {
    role?: string;
    tenantId?: string;
    masterId?: string;
    [key: string]: unknown;
  }
): Promise<PermissionCheckResult> => {
  const userRef = db.collection("users").doc(userId);
  let userData: UserDoc | undefined;
  let tenantId: string | undefined;
  let role: string | undefined;
  let isSuperAdmin = false;
  let isMaster = false;

  // Use Claims if available
  if (claims && claims.role && claims.tenantId) {
    role = claims.role.toUpperCase();
    tenantId = claims.tenantId;
    isSuperAdmin = role === "SUPERADMIN";
    isMaster = role === "MASTER" || role === "ADMIN" || role === "WK"; // simplified check based on role claim
    // Note: claims usually up to date.
  }

  // If claims missing or specific data needed, fetch User
  // We MUST fetch user if we need userData (e.g. for name) OR if we are Master (to get limits)
  // Actually, if we are Master, userRef IS masterRef. We need to fetch it to get limits anyway.
  // If we are Member, we need MasterRef. If we have masterId in claims, we can skip User fetch?
  // BUT return type expects userData. If consumer needs userData.name, we fail.
  // We'll optimistically skip User fetch ONLY IF we are Member AND have masterId.
  // In that case userData will be mock/partial?
  // To be safe, we might always fetch User if name is needed. But for "Update/Delete", name is not needed.
  // Let's assume for now we fetch User unless we are SURE we don't need it.
  // BUT the critical optimization is avoiding the Member->User->Master chain (2 reads).
  // If Member, we want to jump to Master (1 read). User data (name) might be sacrificed or fetched only on Create?

  // Strategy: Always fetch Master (limit checks).
  // If User == Master, 1 read.
  // If User != Master, 2 reads normally.
  // Optimization: If User != Master and claims.masterId exists, fetch Master directly.
  // UserRef is still returned but might not have data loaded?
  // The interface promises `userData: UserDoc`.
  // I will fetch user ONLY if claims are missing OR if it is the Master (logic overlap).

  if (!role || !tenantId) {
    // Fallback: Fetch User
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new Error("User not found");
    userData = userSnap.data() as UserDoc;
    role = (userData.role || "").toUpperCase();
    // @ts-ignore - Handle typo in production DB
    tenantId = userData.tenantId || userData.tentantId || userData.companyId;
  }

  isSuperAdmin = role === "SUPERADMIN";
  if (!tenantId && !isSuperAdmin) throw new Error("User has no tenantId");

  isMaster =
    role === "MASTER" ||
    role === "ADMIN" ||
    role === "WK" ||
    (userData
      ? !userData.masterId && !userData.masterID && !!userData.subscription
      : false);
  // If userData missing (claims path), we trust role.

  let masterRef: FirebaseFirestore.DocumentReference;
  let masterData: UserDoc;

  if (isMaster || isSuperAdmin) {
    masterRef = userRef;
    if (userData) {
      masterData = userData;
    } else {
      // Claims said Master, but we didn't fetch user yet.
      // We NEED masterData for limits.
      const s = await masterRef.get();
      if (!s.exists) throw new Error("Master not found");
      masterData = s.data() as UserDoc;
      userData = masterData; // Set userData too
    }
  } else {
    // Member
    const masterId =
      claims?.masterId ||
      (userData
        ? userData.masterId || userData.masterID || userData.ownerId
        : null);

    if (!masterId) {
      // If we didn't fetch user yet, do it now to find masterId?
      if (!userData) {
        const userSnap = await userRef.get();
        if (!userSnap.exists) throw new Error("User not found");
        userData = userSnap.data() as UserDoc;
        const foundMasterId =
          userData.masterId || userData.masterID || userData.ownerId;
        if (!foundMasterId) throw new Error("Member has no masterId");
        masterRef = db.collection("users").doc(foundMasterId);
      } else {
        throw new Error("Member has no masterId");
      }
    } else {
      masterRef = db.collection("users").doc(masterId);
    }

    const masterSnap = await masterRef.get();
    if (!masterSnap.exists) throw new Error("Master account not found");
    masterData = masterSnap.data() as UserDoc;

    // If we skipped user fetch, userData is undefined.
    // The interface requires it. We should return partial or empty?
    if (!userData) {
      // This is the optimization case: We skipped user fetch.
      // We populate minimal userData from claims
      userData = {
        role: role!,
        tenantId: tenantId!,
        masterId: masterId,
      } as UserDoc;
    }
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
