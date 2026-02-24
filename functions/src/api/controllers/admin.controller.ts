import { Request, Response } from "express";
import { db, auth } from "../../init";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  generateRandomPassword,
  isValidEmail,
} from "../../lib/admin-helpers";
import { UserDoc } from "../../lib/auth-helpers";
import {
  isSuperAdminClaim,
  isTenantAdminClaim,
} from "../../lib/request-auth";
import {
  enforceTenantPlanLimit,
  getTenantUsersUsage,
} from "../../lib/tenant-plan-policy";

export function normalizePhoneNumber(value: unknown): string {
  if (!value) return "";
  let digits = String(value).replace(/\D/g, "");

  if (digits.length === 10 || digits.length === 11) {
    digits = "55" + digits;
  }

  if (digits.length === 12 && digits.startsWith("55")) {
    digits = `${digits.substring(0, 4)}9${digits.substring(4)}`;
  }

  return digits;
}

export async function upsertPhoneNumberIndexTx(
  transaction: FirebaseFirestore.Transaction,
  params: {
    userId: string;
    tenantId: string;
    newPhoneNumber?: unknown;
    previousPhoneNumber?: unknown;
    now: FirebaseFirestore.Timestamp;
  },
) {
  const { userId, tenantId, newPhoneNumber, previousPhoneNumber, now } = params;
  const nextPhone = normalizePhoneNumber(newPhoneNumber);
  const prevPhone = normalizePhoneNumber(previousPhoneNumber);

  if (!nextPhone && !prevPhone) return;

  if (nextPhone) {
    const indexRef = db.collection("phoneNumberIndex").doc(nextPhone);
    const indexSnap = await transaction.get(indexRef);
    const indexData = indexSnap.data() as { userId?: string } | undefined;

    if (indexSnap.exists && indexData?.userId && indexData.userId !== userId) {
      throw new Error("PHONE_ALREADY_LINKED");
    }

    transaction.set(
      indexRef,
      {
        userId,
        tenantId,
        updatedAt: now,
      },
      { merge: true },
    );
  }

  if (prevPhone && prevPhone !== nextPhone) {
    const prevRef = db.collection("phoneNumberIndex").doc(prevPhone);
    const prevSnap = await transaction.get(prevRef);
    const prevData = prevSnap.data() as { userId?: string } | undefined;
    if (prevSnap.exists && prevData?.userId === userId) {
      transaction.delete(prevRef);
    }
  }
}

export const createMember = async (req: Request, res: Response) => {
  try {
    const loggedUserId = req.user!.uid;
    const input = req.body;

    if (!input.name || input.name.trim().length < 2) {
      return res
        .status(400)
        .json({ message: "Nome deve ter pelo menos 2 caracteres" });
    }
    if (!input.email || !isValidEmail(input.email)) {
      return res.status(400).json({ message: "Email invÃ¡lido" });
    }

    const isSuperAdmin = isSuperAdminClaim(req);
    if (!isSuperAdmin && !isTenantAdminClaim(req)) {
      return res.status(403).json({
        message: "Apenas administradores podem criar membros da equipe",
      });
    }

    // Super admin can specify a target master, otherwise use logged user
    const masterId =
      isSuperAdmin && input.targetMasterId
        ? input.targetMasterId
        : loggedUserId;

    const masterRef = db.collection("users").doc(masterId);
    const masterSnap = await masterRef.get();

    if (!masterSnap.exists) {
      return res.status(404).json({ message: "Conta administradora nao encontrada." });
    }

    const masterData = masterSnap.data() as UserDoc;

    const tenantId = masterData.tenantId || masterData.companyId;

    if (!tenantId) {
      return res.status(412).json({
        message: "Erro na conta: Identificador do tenant nÃ£o encontrado.",
      });
    }

    const usersUsage = await getTenantUsersUsage(tenantId);
    const userLimitDecision = await enforceTenantPlanLimit({
      tenantId,
      feature: "maxUsers",
      currentUsage: usersUsage,
      uid: loggedUserId,
      requestId: req.requestId,
      route: req.path,
      isSuperAdmin,
    });
    if (!userLimitDecision.allowed) {
      return res.status(userLimitDecision.statusCode || 402).json({
        message:
          userLimitDecision.message ||
          "Limite de usuários atingido para o plano atual.",
        code: userLimitDecision.code || "PLAN_LIMIT_EXCEEDED",
      });
    }

    // Check Email in Auth
    try {
      await auth.getUserByEmail(input.email);
      return res
        .status(409)
        .json({ message: "Este email jÃ¡ estÃ¡ cadastrado no sistema" });
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code !== "auth/user-not-found"
      ) {
        throw err;
      }
    }

    // Create Auth User
    const password = input.password || generateRandomPassword();
    let memberAuthUser;
    try {
      memberAuthUser = await auth.createUser({
        email: input.email,
        password: password,
        displayName: input.name,
        emailVerified: false,
      });
    } catch (err) {
      console.error("Error creating Auth user:", err);
      return res.status(500).json({ message: "Erro ao criar usuÃ¡rio." });
    }

    const memberId = memberAuthUser.uid;

    // Transactional Write
    try {
      await db.runTransaction(async (transaction) => {
        const now = Timestamp.now();
        const companyRef = db.collection("companies").doc(tenantId);
        const companySnap = await transaction.get(companyRef);

        const memberRef = db.collection("users").doc(memberId);

        transaction.set(memberRef, {
          name: input.name.trim(),
          email: input.email.toLowerCase().trim(),
          phoneNumber: normalizePhoneNumber(input.phoneNumber) || null,
          photoUrl: null,
          role: "MEMBER",
          masterId: masterId,
          tenantId: tenantId,
          companyName: masterData.companyName || "Minha Empresa", // Legacy/Compat
          companyId: tenantId, // Standardize
          createdAt: now,
          updatedAt: now,
        });

        await upsertPhoneNumberIndexTx(transaction, {
          userId: memberId,
          tenantId,
          newPhoneNumber: input.phoneNumber,
          now,
        });

        const permissionsInput = input.permissions || {};
        for (const [pageSlug, perms] of Object.entries(permissionsInput)) {
          // perms is untyped input
          const permData = perms as Record<string, boolean>;
          const pageId = pageSlug.replace(/\//g, "_").replace(/^_/, "");
          const permRef = memberRef.collection("permissions").doc(pageId);

          transaction.set(permRef, {
            pageId,
            pageSlug,
            pageName: pageSlug, // Simplified
            canView: permData.canView ?? false,
            canCreate: permData.canCreate ?? false,
            canEdit: permData.canEdit ?? false,
            canDelete: permData.canDelete ?? false,
            updatedAt: now,
          });
        }

        transaction.update(masterRef, {
          "usage.users": FieldValue.increment(1),
          updatedAt: now,
        });

        if (companySnap.exists) {
          transaction.update(companyRef, {
            "usage.users": FieldValue.increment(1),
            updatedAt: now,
          });
        }
      });

      return res.status(201).json({
        success: true,
        memberId,
        message: `UsuÃ¡rio ${input.name} criado com sucesso!`,
      });
    } catch (err) {
      console.error("Transaction failed, rolling back:", err);
      try {
        await auth.deleteUser(memberId);
      } catch (e) {
        // Safe to ignore rollback failure
        console.error("Rollback failed", e);
      }
      if (err instanceof Error && err.message === "PHONE_ALREADY_LINKED") {
        return res.status(409).json({ message: "Telefone jÃ¡ vinculado" });
      }
      return res
        .status(500)
        .json({ message: "Erro ao salvar dados do usuÃ¡rio." });
    }
  } catch (error: unknown) {
    console.error("createMember Error:", error);
    const message = error instanceof Error ? error.message : "Erro interno.";
    return res.status(500).json({ message });
  }
};

export const updateMember = async (req: Request, res: Response) => {
  try {
    const masterId = req.user!.uid;
    const { id } = req.params;
    const { name, email, password, phoneNumber } = req.body;

    if (!id) return res.status(400).json({ message: "ID obrigatÃ³rio." });

    const memberSnap = await db.collection("users").doc(id).get();

    if (!memberSnap.exists)
      return res.status(404).json({ message: "Membro nÃ£o encontrado" });

    const memberData = memberSnap.data();

    const isSuperAdmin = isSuperAdminClaim(req);
    if (!isSuperAdmin && !isTenantAdminClaim(req))
      return res.status(403).json({ message: "PermissÃ£o negada." });
    if (!isSuperAdmin && memberData?.masterId !== masterId)
      return res.status(403).json({ message: "PermissÃ£o negada." });

    // Update Auth
    const authUpdates: {
      email?: string;
      password?: string;
      displayName?: string;
    } = {};
    if (email && email !== memberData?.email) authUpdates.email = email;
    if (password && password.length >= 6) authUpdates.password = password;
    if (name) authUpdates.displayName = name;

    if (Object.keys(authUpdates).length > 0) {
      try {
        await auth.updateUser(id, authUpdates);
      } catch (err: unknown) {
        if (
          err &&
          typeof err === "object" &&
          "code" in err &&
          (err as { code: string }).code === "auth/email-already-exists"
        ) {
          return res.status(409).json({ message: "Email jÃ¡ em uso." });
        }
        return res
          .status(500)
          .json({ message: "Erro ao atualizar credenciais." });
      }
    }

    const firestoreUpdates: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    };
    if (name) firestoreUpdates.name = name;
    if (email) firestoreUpdates.email = email;
    if (phoneNumber !== undefined) {
      firestoreUpdates.phoneNumber = normalizePhoneNumber(phoneNumber);
    }

    try {
      await db.runTransaction(async (transaction) => {
        const now = Timestamp.now();
        const memberRef = db.collection("users").doc(id);

        if (phoneNumber !== undefined) {
          await upsertPhoneNumberIndexTx(transaction, {
            userId: id,
            tenantId: (
              memberData?.tenantId ||
              memberData?.companyId ||
              ""
            ).trim(),
            newPhoneNumber: phoneNumber,
            previousPhoneNumber: memberData?.phoneNumber,
            now,
          });
        }

        transaction.update(memberRef, {
          ...firestoreUpdates,
          updatedAt: now,
        });
      });
    } catch (err) {
      if (err instanceof Error && err.message === "PHONE_ALREADY_LINKED") {
        return res.status(409).json({ message: "Telefone jÃ¡ vinculado" });
      }
      throw err;
    }

    return res.json({
      success: true,
      message: "Membro atualizado com sucesso.",
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ message });
  }
};

export const deleteMember = async (req: Request, res: Response) => {
  try {
    const loggedUserId = req.user!.uid;
    const { id } = req.params;

    if (!id) return res.status(400).json({ message: "ID obrigatÃ³rio." });

    const memberSnap = await db.collection("users").doc(id).get();
    if (!memberSnap.exists)
      return res.status(404).json({ message: "Membro nÃ£o encontrado" });

    const memberData = memberSnap.data();
    const isSuperAdmin = isSuperAdminClaim(req);

    // Super admin can delete any member; otherwise check permissions
    if (!isSuperAdmin) {
      if (!isTenantAdminClaim(req))
        return res.status(403).json({ message: "PermissÃ£o negada." });
      if (memberData?.masterId !== loggedUserId)
        return res.status(403).json({ message: "PermissÃ£o negada." });
    }

    // Get the actual master of this member for decrementing usage
    const actualMasterId = memberData?.masterId || loggedUserId;
    const masterRef = db.collection("users").doc(actualMasterId);
    const masterSnap = await masterRef.get();
    const masterData = masterSnap.data() as UserDoc | undefined;

    const tenantId =
      memberData?.tenantId || masterData?.tenantId || masterData?.companyId;

    try {
      await auth.deleteUser(id);
    } catch (err: unknown) {
      if (
        !err ||
        typeof err !== "object" ||
        !("code" in err) ||
        (err as { code: string }).code !== "auth/user-not-found"
      ) {
        return res
          .status(500)
          .json({ message: "Erro ao remover acesso do usuÃ¡rio." });
      }
    }

    await db.runTransaction(async (t) => {
      const companyRef = db.collection("companies").doc(tenantId!);
      const companySnap = await t.get(companyRef);
      const memberPhone = normalizePhoneNumber(memberData?.phoneNumber);

      t.delete(db.collection("users").doc(id));
      if (memberPhone) {
        const phoneRef = db.collection("phoneNumberIndex").doc(memberPhone);
        const phoneSnap = await t.get(phoneRef);
        const phoneData = phoneSnap.data() as { userId?: string } | undefined;
        if (phoneSnap.exists && phoneData?.userId === id) {
          t.delete(phoneRef);
        }
      }
      t.update(db.collection("users").doc(actualMasterId), {
        "usage.users": FieldValue.increment(-1),
      });

      if (companySnap.exists) {
        t.update(companyRef, { "usage.users": FieldValue.increment(-1) });
      }
    });

    return res.json({ success: true, message: "Membro removido." });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ message });
  }
};

export const updatePermissions = async (req: Request, res: Response) => {
  console.log("[updatePermissions] request received", {
    mode: req.body?.mode,
    pageId: req.body?.pageId,
    hasTargetUser: Boolean(req.body?.memberId || req.body?.targetUserId),
    permissionKeys: req.body?.permissions
      ? Object.keys(req.body.permissions as Record<string, unknown>)
      : [],
  });

  try {
    const masterId = req.user!.uid;
    // Support both memberId and targetUserId for compatibility
    const { memberId, targetUserId, permissions, pageId, key, value, mode } =
      req.body;

    const actualMemberId = memberId || targetUserId;

    console.log("[updatePermissions] masterId:", masterId);
    console.log("[updatePermissions] actualMemberId:", actualMemberId);

    if (!actualMemberId) {
      return res.status(400).json({ message: "ID do membro Ã© obrigatÃ³rio." });
    }

    const memberSnap = await db.collection("users").doc(actualMemberId).get();

    console.log("[updatePermissions] memberSnap.exists:", memberSnap.exists);

    if (!memberSnap.exists) {
      console.log(
        "[updatePermissions] Member not found with ID:",
        actualMemberId,
      );
      return res.status(404).json({ message: "Membro nÃ£o encontrado." });
    }

    const memberData = memberSnap.data();
    const isSuperAdmin = isSuperAdminClaim(req);

    if (!isSuperAdmin && !isTenantAdminClaim(req)) {
      return res.status(403).json({ message: "PermissÃ£o negada." });
    }
    if (!isSuperAdmin && memberData?.masterId !== masterId) {
      return res.status(403).json({ message: "PermissÃ£o negada." });
    }

    const permissionsRef = db
      .collection("users")
      .doc(actualMemberId)
      .collection("permissions");

    // Handle single permission update mode
    if (mode === "single" && pageId && key) {
      const docRef = permissionsRef.doc(pageId);
      const existingDoc = await docRef.get();
      const existingData = existingDoc.exists ? existingDoc.data() : {};

      await docRef.set(
        {
          pageId,
          pageSlug: `/${pageId}`,
          canView: existingData?.canView ?? false,
          canCreate: existingData?.canCreate ?? false,
          canEdit: existingData?.canEdit ?? false,
          canDelete: existingData?.canDelete ?? false,
          [key]: value,
          updatedAt: new Date().toISOString(),
          updatedBy: masterId,
        },
        { merge: true },
      );

      return res.json({ success: true, message: "PermissÃ£o atualizada." });
    }

    // Handle bulk permissions update
    if (!permissions) {
      return res.status(400).json({ message: "PermissÃµes sÃ£o obrigatÃ³rias." });
    }

    const batch = db.batch();

    for (const [pId, perms] of Object.entries(permissions)) {
      // perms is untyped
      const p = perms as Record<string, boolean>;
      const docRef = permissionsRef.doc(pId);
      batch.set(docRef, {
        pageId: pId,
        pageSlug: `/${pId}`,
        canView: p.canView ?? false,
        canCreate: p.canCreate ?? false,
        canEdit: p.canEdit ?? false,
        canDelete: p.canDelete ?? false,
        updatedAt: new Date().toISOString(),
        updatedBy: masterId,
      });
    }

    await batch.commit();
    return res.json({ success: true, message: "PermissÃµes atualizadas." });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ message });
  }
};

export const getAllTenantsBilling = async (req: Request, res: Response) => {
  try {
    if (!isSuperAdminClaim(req)) {
      return res.status(403).json({ message: "Acesso negado." });
    }

    interface BillingUserData {
      tenantId?: string;
      companyId?: string;
      companyName?: string;
      createdAt?: string;
      planId?: string;
      name?: string;
      displayName?: string;
      email?: string;
      subscriptionStatus?: string;
      currentPeriodEnd?: unknown;
      cancelAtPeriodEnd?: boolean;
      subscription?: {
        status?: string;
        currentPeriodEnd?: unknown;
        cancelAtPeriodEnd?: boolean;
        cancel_at_period_end?: boolean;
      };
      usage?: {
        users?: number;
        proposals?: number;
        clients?: number;
        products?: number;
      };
      phoneNumber?: string;
      [key: string]: unknown;
    }

    interface TenantData {
      name?: string;
      slug?: string;
      createdAt?: string;
      logoUrl?: string;
      primaryColor?: string;
      niche?: string;
      whatsappEnabled?: boolean;
    }

    // Busca usuários MASTER/admin (donos de empresa)
    const usersSnapshot = await db
      .collection("users")
      .where("role", "in", ["MASTER", "admin", "ADMIN", "master"])
      .get();

    console.log(`[getAllTenantsBilling] Found ${usersSnapshot.docs.length} master users`);

    // Collect unique tenant IDs and plan IDs for batch fetch
    const tenantIds = new Set<string>();
    const planIds = new Set<string>();
    const tierToName: Record<string, string> = {
      free: "Gratuito",
      starter: "Starter",
      pro: "Pro",
      enterprise: "Enterprise",
    };

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data() as BillingUserData;
      const tenantId = userData.tenantId || userData.companyId;
      if (tenantId) tenantIds.add(tenantId);

      const planId = String(userData.planId || "free").toLowerCase();
      if (!tierToName[planId] && planId !== "free") {
        planIds.add(userData.planId!);
      }
    }

    // Batch fetch all tenant docs at once
    const tenantDataMap = new Map<string, TenantData>();
    if (tenantIds.size > 0) {
      try {
        const tenantRefs = Array.from(tenantIds).map((id) =>
          db.collection("tenants").doc(id),
        );
        const tenantSnaps = await db.getAll(...tenantRefs);
        for (const snap of tenantSnaps) {
          if (snap.exists) {
            tenantDataMap.set(snap.id, (snap.data() as TenantData) || {});
          }
        }
      } catch (err) {
        console.warn("[getAllTenantsBilling] Batch tenant fetch failed, continuing without tenant data:", err);
      }
    }

    // Batch fetch all plan docs at once
    const planNameMap = new Map<string, string>();
    const planTierMap = new Map<string, string>(); // Maps document ID -> tier name
    if (planIds.size > 0) {
      try {
        const planRefs = Array.from(planIds).map((id) =>
          db.collection("plans").doc(id),
        );
        const planSnaps = await db.getAll(...planRefs);
        for (const snap of planSnaps) {
          if (snap.exists) {
            const planData = snap.data();
            planNameMap.set(
              snap.id,
              tierToName[planData?.tier] || planData?.name || snap.id,
            );
            // Store the tier so we can normalize planId for the frontend
            if (planData?.tier) {
              planTierMap.set(snap.id, String(planData.tier).toLowerCase());
            }
          }
        }
      } catch (err) {
        console.warn("[getAllTenantsBilling] Batch plan fetch failed, continuing without plan names:", err);
      }
    }

    const normalizeStatus = (rawStatus: unknown): string => {
      if (!rawStatus) return "";
      return String(rawStatus).trim().toLowerCase();
    };

    const parsePeriodEnd = (value: unknown): Date | null => {
      if (!value) return null;

      if (typeof value === "string") {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      }

      if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
      }

      if (
        typeof value === "object" &&
        value !== null &&
        "toDate" in value &&
        typeof (value as { toDate?: unknown }).toDate === "function"
      ) {
        const converted = (value as { toDate: () => Date }).toDate();
        return Number.isNaN(converted.getTime()) ? null : converted;
      }

      return null;
    };

    const deriveTenantStatus = (userData: BillingUserData): string => {
      const normalizedPlanId = String(userData.planId || "free").toLowerCase();
      if (normalizedPlanId === "free") return "free";

      const rawStatus =
        normalizeStatus(userData.subscriptionStatus) ||
        normalizeStatus(userData.subscription?.status);

      const blockedStatuses = new Set([
        "inactive",
        "canceled",
        "cancelled",
        "unpaid",
        "payment_failed",
      ]);

      if (blockedStatuses.has(rawStatus)) {
        return "inactive";
      }

      const periodEnd =
        parsePeriodEnd(userData.currentPeriodEnd) ||
        parsePeriodEnd(userData.subscription?.currentPeriodEnd);

      const cancelAtPeriodEnd = Boolean(
        userData.cancelAtPeriodEnd ||
        userData.subscription?.cancelAtPeriodEnd ||
        userData.subscription?.cancel_at_period_end,
      );

      if (cancelAtPeriodEnd && periodEnd && periodEnd.getTime() <= Date.now()) {
        return "inactive";
      }

      if (!rawStatus && periodEnd && periodEnd.getTime() <= Date.now()) {
        return "inactive";
      }

      return "active";
    };

    // Process all users synchronously using pre-fetched data
    const tenantsData = [];
    for (const userDoc of usersSnapshot.docs) {
      try {
        const userData = userDoc.data() as BillingUserData;
        const tenantId = userData.tenantId || userData.companyId;
        const tenantData = (tenantId && tenantDataMap.get(tenantId)) || {};

        const rawPlanId = String(userData.planId || "free");
        // Normalize planId to tier name: if it's a document ID, resolve to tier; otherwise use as-is
        const planId = tierToName[rawPlanId.toLowerCase()]
          ? rawPlanId.toLowerCase()
          : (planTierMap.get(rawPlanId) || rawPlanId.toLowerCase());
        let planName = tierToName[planId.toLowerCase()];
        if (!planName && planId !== "free") {
          planName = planNameMap.get(planId) || planId;
        }

        const effectiveStatus = deriveTenantStatus(userData);

        tenantsData.push({
          tenant: {
            id: tenantId || userDoc.id,
            name: (tenantData as TenantData).name || userData.companyName || "Sem nome",
            slug: (tenantData as TenantData).slug,
            createdAt: (tenantData as TenantData).createdAt || userData.createdAt,
            logoUrl: (tenantData as TenantData).logoUrl,
            primaryColor: (tenantData as TenantData).primaryColor,
            niche: (tenantData as TenantData).niche,
            whatsappEnabled: (tenantData as TenantData).whatsappEnabled,
          },
          admin: {
            id: userDoc.id,
            name: userData.name || userData.displayName || "",
            email: userData.email || "",
            phoneNumber: userData.phoneNumber,
            subscriptionStatus: userData.subscriptionStatus,
            currentPeriodEnd: userData.currentPeriodEnd,
            subscription: userData.subscription,
          },
          planName: planName || planId,
          planId,
          subscriptionStatus: effectiveStatus,
          usage: {
            users: userData.usage?.users || 0,
            proposals: userData.usage?.proposals || 0,
            clients: userData.usage?.clients || 0,
            products: userData.usage?.products || 0,
          },
        });
      } catch (docErr) {
        console.error(`[getAllTenantsBilling] Error processing user doc ${userDoc.id}, skipping:`, docErr);
      }
    }

    console.log(`[getAllTenantsBilling] Returning ${tenantsData.length} tenants`);
    return res.json(tenantsData);
  } catch (error: unknown) {
    console.error("Error getting tenants:", error);
    return res.status(500).json({ message: "Erro ao buscar tenants." });
  }
};

export const updateCredentials = async (req: Request, res: Response) => {
  try {
    const { userId, email, password, phoneNumber } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "ID do usuÃ¡rio Ã© obrigatÃ³rio" });
    }

    if (!isSuperAdminClaim(req)) {
      return res.status(403).json({
        message:
          "PermissÃ£o negada. Apenas super admins podem alterar credenciais.",
      });
    }

    // Update Auth
    const updateData: { email?: string; password?: string } = {};
    if (email) updateData.email = email;
    if (password && password.length >= 6) updateData.password = password;

    if (Object.keys(updateData).length > 0) {
      await auth.updateUser(userId, updateData);
    }

    // Update Firestore User
    const firestoreUpdate: any = {};
    if (email) firestoreUpdate.email = email;
    if (phoneNumber !== undefined) {
      firestoreUpdate.phoneNumber = normalizePhoneNumber(phoneNumber) || null;
    }

    if (Object.keys(firestoreUpdate).length > 0) {
      if (phoneNumber !== undefined) {
        try {
          await db.runTransaction(async (transaction) => {
            const userRef = db.collection("users").doc(userId);
            const userSnap = await transaction.get(userRef);
            const userData = userSnap.data();

            await upsertPhoneNumberIndexTx(transaction, {
              userId,
              tenantId: userData?.tenantId || userData?.companyId || "",
              newPhoneNumber: phoneNumber,
              previousPhoneNumber: userData?.phoneNumber,
              now: Timestamp.now(),
            });

            transaction.update(userRef, firestoreUpdate);
          });
        } catch (err: unknown) {
          if (err instanceof Error && err.message === "PHONE_ALREADY_LINKED") {
            return res
              .status(409)
              .json({ message: "Telefone jÃ¡ vinculado a outro usuÃ¡rio." });
          }
          throw err;
        }
      } else {
        await db.collection("users").doc(userId).update(firestoreUpdate);
      }
    }

    return res.json({
      success: true,
      message: "Credenciais atualizadas com sucesso.",
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro ao atualizar credenciais";
    return res.status(500).json({ message });
  }
};

export const updateUserPlan = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { planId } = req.body;

    if (!userId || !planId) {
      return res
        .status(400)
        .json({ message: "ID do usuÃ¡rio e Plan ID sÃ£o obrigatÃ³rios" });
    }

    if (!isSuperAdminClaim(req)) {
      return res.status(403).json({
        message: "PermissÃ£o negada. Apenas super admins podem alterar planos.",
      });
    }

    // Update Plan
    await db.collection("users").doc(userId).update({
      planId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.json({
      success: true,
      message: "Plano atualizado com sucesso.",
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro ao atualizar plano";
    return res.status(500).json({ message });
  }
};

export const updateUserSubscription = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    if (!userId) {
      return res.status(400).json({ message: "ID do usuÃ¡rio Ã© obrigatÃ³rio" });
    }

    if (!isSuperAdminClaim(req)) {
      return res.status(403).json({
        message:
          "PermissÃ£o negada. Apenas super admins podem alterar assinaturas.",
      });
    }

    // Allowed fields to update
    const allowedFields = [
      "subscriptionStatus",
      "currentPeriodEnd",
      "isManualSubscription",
    ];
    const safeUpdates: Record<string, any> = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        safeUpdates[field] = updates[field];
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      return res
        .status(400)
        .json({ message: "Nenhum campo vÃ¡lido para atualizaÃ§Ã£o" });
    }

    safeUpdates.updatedAt = FieldValue.serverTimestamp();

    // Update Subscription
    await db.collection("users").doc(userId).update(safeUpdates);

    return res.json({
      success: true,
      message: "Assinatura atualizada com sucesso.",
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro ao atualizar assinatura";
    return res.status(500).json({ message });
  }
};

import { reportWhatsAppOverage } from "../../services/whatsappBilling";

export const testWhatsAppBilling = async (req: Request, res: Response) => {
  try {
    const { tenantId, month } = req.body;

    if (!isSuperAdminClaim(req)) {
      return res.status(403).json({
        message: "PermissÃ£o negada. Apenas super admins podem testar billing.",
      });
    }

    if (!tenantId || !month) {
      return res
        .status(400)
        .json({ message: "tenantId e month sÃ£o obrigatÃ³rios" });
    }

    const result = await reportWhatsAppOverage(tenantId, month);

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ message });
  }
};
