import { Request, Response } from "express";
import { db, auth } from "../../init";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { generateRandomPassword } from "../../lib/admin-helpers";
import { UserDoc } from "../../lib/auth-helpers";
import { isSuperAdminClaim, isTenantAdminClaim } from "../../lib/request-auth";
import {
  enforceTenantPlanLimit,
  getTenantUsersUsage,
} from "../../lib/tenant-plan-policy";
import {
  normalizeBrazilPhoneNumber,
  validateBrazilMobilePhone,
  validateEmailForSignup,
} from "../../lib/contact-validation";

export function normalizePhoneNumber(value: unknown): string {
  return normalizeBrazilPhoneNumber(value);
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

  let indexSnap: FirebaseFirestore.DocumentSnapshot | undefined;
  let prevSnap: FirebaseFirestore.DocumentSnapshot | undefined;
  let indexRef: FirebaseFirestore.DocumentReference | undefined;
  let prevRef: FirebaseFirestore.DocumentReference | undefined;

  // 1. DO ALL GETS FIRST
  if (nextPhone) {
    indexRef = db.collection("phoneNumberIndex").doc(nextPhone);
    indexSnap = await transaction.get(indexRef);
  }

  if (prevPhone && prevPhone !== nextPhone) {
    prevRef = db.collection("phoneNumberIndex").doc(prevPhone);
    prevSnap = await transaction.get(prevRef);
  }

  // 2. DO ALL WRITES AFTER GETS
  if (nextPhone && indexRef && indexSnap) {
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

  if (prevPhone && prevPhone !== nextPhone && prevRef && prevSnap) {
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
    const emailValidation = await validateEmailForSignup(input.email);
    if (!emailValidation.valid) {
      return res.status(400).json({
        message: emailValidation.reason || "Email inválido",
      });
    }

    if (input.phoneNumber !== undefined && input.phoneNumber !== null) {
      const phoneValidation = validateBrazilMobilePhone(input.phoneNumber);
      if (!phoneValidation.valid) {
        return res.status(400).json({
          message: phoneValidation.reason || "Telefone inválido",
        });
      }
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
      return res
        .status(404)
        .json({ message: "Conta administradora nao encontrada." });
    }

    const masterData = masterSnap.data() as UserDoc;

    const tenantId = masterData.tenantId || masterData.companyId;

    if (!tenantId) {
      return res.status(412).json({
        message: "Erro na conta: Identificador do tenant não encontrado.",
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
      await auth.getUserByEmail(emailValidation.normalizedEmail);
      return res
        .status(409)
        .json({ message: "Este email já está cadastrado no sistema" });
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
        email: emailValidation.normalizedEmail,
        password: password,
        displayName: input.name,
        emailVerified: false,
      });
    } catch (err) {
      console.error("Error creating Auth user:", err);
      return res.status(500).json({ message: "Erro ao criar usuário." });
    }

    const memberId = memberAuthUser.uid;

    try {
      await auth.setCustomUserClaims(memberId, {
        role: "MEMBER",
        masterId: masterId,
        tenantId: tenantId,
        companyId: tenantId,
      });
    } catch (err) {
      console.error("Error setting custom claims:", err);
      await auth.deleteUser(memberId);
      return res
        .status(500)
        .json({ message: "Erro ao configurar permissões do usuário." });
    }

    // Transactional Write
    try {
      await db.runTransaction(async (transaction) => {
        const now = Timestamp.now();
        const companyRef = db.collection("companies").doc(tenantId);
        const companySnap = await transaction.get(companyRef);

        const memberRef = db.collection("users").doc(memberId);

        await upsertPhoneNumberIndexTx(transaction, {
          userId: memberId,
          tenantId,
          newPhoneNumber: input.phoneNumber,
          now,
        });

        transaction.set(memberRef, {
          name: input.name.trim(),
          email: emailValidation.normalizedEmail,
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
        message: `Usuário ${input.name} criado com sucesso!`,
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
        return res.status(409).json({ message: "Telefone já vinculado" });
      }
      return res
        .status(500)
        .json({ message: "Erro ao salvar dados do usuário." });
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

    if (!id) return res.status(400).json({ message: "ID obrigatório." });

    const memberSnap = await db.collection("users").doc(id).get();

    if (!memberSnap.exists)
      return res.status(404).json({ message: "Membro não encontrado" });

    const memberData = memberSnap.data();

    const isSuperAdmin = isSuperAdminClaim(req);
    if (!isSuperAdmin && !isTenantAdminClaim(req))
      return res.status(403).json({ message: "Permissão negada." });
    if (!isSuperAdmin && memberData?.masterId !== masterId)
      return res.status(403).json({ message: "Permissão negada." });

    let normalizedEmail: string | null = null;
    if (email !== undefined && email !== null && String(email).trim() !== "") {
      const emailValidation = await validateEmailForSignup(email);
      if (!emailValidation.valid) {
        return res.status(400).json({
          message: emailValidation.reason || "Email inválido",
        });
      }
      normalizedEmail = emailValidation.normalizedEmail;
    }

    if (phoneNumber !== undefined && phoneNumber !== null) {
      const phoneValidation = validateBrazilMobilePhone(phoneNumber);
      if (!phoneValidation.valid) {
        return res.status(400).json({
          message: phoneValidation.reason || "Telefone inválido",
        });
      }
    }

    // Update Auth
    const authUpdates: {
      email?: string;
      password?: string;
      displayName?: string;
    } = {};
    if (
      normalizedEmail &&
      normalizedEmail !== String(memberData?.email || "").toLowerCase()
    ) {
      authUpdates.email = normalizedEmail;
    }
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
          return res.status(409).json({ message: "Email já em uso." });
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
    if (normalizedEmail) firestoreUpdates.email = normalizedEmail;
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
        return res.status(409).json({ message: "Telefone já vinculado" });
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

    if (!id) return res.status(400).json({ message: "ID obrigatório." });

    const memberSnap = await db.collection("users").doc(id).get();
    if (!memberSnap.exists)
      return res.status(404).json({ message: "Membro não encontrado" });

    const memberData = memberSnap.data();
    const isSuperAdmin = isSuperAdminClaim(req);

    // Super admin can delete any member; otherwise check permissions
    if (!isSuperAdmin) {
      if (!isTenantAdminClaim(req))
        return res.status(403).json({ message: "Permissão negada." });
      if (memberData?.masterId !== loggedUserId)
        return res.status(403).json({ message: "Permissão negada." });
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
          .json({ message: "Erro ao remover acesso do usuário." });
      }
    }

    await db.runTransaction(async (t) => {
      const companyRef = db.collection("companies").doc(tenantId!);
      const companySnap = await t.get(companyRef);
      const memberPhone = normalizePhoneNumber(memberData?.phoneNumber);

      let phoneSnap: FirebaseFirestore.DocumentSnapshot | undefined;
      let phoneRef: FirebaseFirestore.DocumentReference | undefined;

      // 1. ALL GETS FIRST
      if (memberPhone) {
        phoneRef = db.collection("phoneNumberIndex").doc(memberPhone);
        phoneSnap = await t.get(phoneRef);
      }

      // 2. ALL WRITES
      t.delete(db.collection("users").doc(id));

      if (memberPhone && phoneSnap && phoneRef) {
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
      return res.status(400).json({ message: "ID do membro é obrigatório." });
    }

    const memberSnap = await db.collection("users").doc(actualMemberId).get();

    console.log("[updatePermissions] memberSnap.exists:", memberSnap.exists);

    if (!memberSnap.exists) {
      console.log(
        "[updatePermissions] Member not found with ID:",
        actualMemberId,
      );
      return res.status(404).json({ message: "Membro não encontrado." });
    }

    const memberData = memberSnap.data();
    const isSuperAdmin = isSuperAdminClaim(req);

    if (!isSuperAdmin && !isTenantAdminClaim(req)) {
      return res.status(403).json({ message: "Permissão negada." });
    }
    if (!isSuperAdmin && memberData?.masterId !== masterId) {
      return res.status(403).json({ message: "Permissão negada." });
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

      return res.json({ success: true, message: "Permissão atualizada." });
    }

    // Handle bulk permissions update
    if (!permissions) {
      return res.status(400).json({ message: "Permissões são obrigatórias." });
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
    return res.json({ success: true, message: "Permissões atualizadas." });
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

    // Busca usuários MASTER/admin/free (donos de empresa ou contas gratuitas)
    const usersSnapshot = await db
      .collection("users")
      .where("role", "in", ["MASTER", "admin", "ADMIN", "master", "free"])
      .get();

    console.log(
      `[getAllTenantsBilling] Found ${usersSnapshot.docs.length} master users`,
    );

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
        console.warn(
          "[getAllTenantsBilling] Batch tenant fetch failed, continuing without tenant data:",
          err,
        );
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
        console.warn(
          "[getAllTenantsBilling] Batch plan fetch failed, continuing without plan names:",
          err,
        );
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
          : planTierMap.get(rawPlanId) || rawPlanId.toLowerCase();
        let planName = tierToName[planId.toLowerCase()];
        if (!planName && planId !== "free") {
          planName = planNameMap.get(planId) || planId;
        }

        const effectiveStatus = deriveTenantStatus(userData);

        tenantsData.push({
          tenant: {
            id: tenantId || userDoc.id,
            name:
              (tenantData as TenantData).name ||
              userData.companyName ||
              "Sem nome",
            slug: (tenantData as TenantData).slug,
            createdAt:
              (tenantData as TenantData).createdAt || userData.createdAt,
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
        console.error(
          `[getAllTenantsBilling] Error processing user doc ${userDoc.id}, skipping:`,
          docErr,
        );
      }
    }

    console.log(
      `[getAllTenantsBilling] Returning ${tenantsData.length} tenants`,
    );
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
      return res.status(400).json({ message: "ID do usuário é obrigatório" });
    }

    if (!isSuperAdminClaim(req)) {
      return res.status(403).json({
        message:
          "Permissão negada. Apenas super admins podem alterar credenciais.",
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
              .json({ message: "Telefone já vinculado a outro usuário." });
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
        .json({ message: "ID do usuário e Plan ID são obrigatórios" });
    }

    if (!isSuperAdminClaim(req)) {
      return res.status(403).json({
        message: "Permissão negada. Apenas super admins podem alterar planos.",
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
      return res.status(400).json({ message: "ID do usuário é obrigatório" });
    }

    if (!isSuperAdminClaim(req)) {
      return res.status(403).json({
        message:
          "Permissão negada. Apenas super admins podem alterar assinaturas.",
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
        .json({ message: "Nenhum campo válido para atualização" });
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

type CreateTenantRequestBody = {
  name?: string;
  slug?: string;
  primaryColor?: string;
  logoUrl?: string;
  niche?: string;
  whatsappEnabled?: boolean;
  adminName?: string;
  adminEmail?: string;
  adminPassword?: string;
  adminPhoneNumber?: string;
  planId?: string;
  subscriptionStatus?: string;
  currentPeriodEnd?: string;
};

function sanitizeSlug(input: string): string {
  const normalized = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/-+/g, "-");
  return normalized || `tenant-${Date.now()}`;
}

async function deleteQueryInBatches(
  query: FirebaseFirestore.Query,
): Promise<number> {
  let totalDeleted = 0;
  let snapshot = await query.limit(400).get();

  while (!snapshot.empty) {
    const batch = db.batch();
    snapshot.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
    totalDeleted += snapshot.size;
    snapshot = await query.limit(400).get();
  }

  return totalDeleted;
}

async function deleteSubcollectionInBatches(
  parentRef: FirebaseFirestore.DocumentReference,
  subcollectionName: string,
): Promise<void> {
  const subQuery = parentRef.collection(subcollectionName);
  await deleteQueryInBatches(subQuery);
}

export const createTenant = async (req: Request, res: Response) => {
  let createdAuthUid: string | null = null;

  try {
    if (!isSuperAdminClaim(req)) {
      return res.status(403).json({
        message: "Permissão negada. Apenas super admins podem criar empresas.",
      });
    }

    const body = (req.body || {}) as CreateTenantRequestBody;
    const tenantName = String(body.name || "").trim();
    const adminName = String(body.adminName || "").trim();
    const adminEmail = String(body.adminEmail || "")
      .trim()
      .toLowerCase();
    const adminPassword = String(body.adminPassword || "");
    const planId = String(body.planId || "free")
      .trim()
      .toLowerCase();

    if (!tenantName || tenantName.length < 2) {
      return res
        .status(400)
        .json({ message: "Nome da empresa deve ter pelo menos 2 caracteres." });
    }

    if (!adminName || adminName.length < 2) {
      return res.status(400).json({
        message: "Nome do administrador deve ter pelo menos 2 caracteres.",
      });
    }

    const adminEmailValidation = await validateEmailForSignup(adminEmail);
    if (!adminEmailValidation.valid) {
      return res.status(400).json({
        message:
          adminEmailValidation.reason || "Email do administrador inválido.",
      });
    }

    if (adminPassword.length < 6) {
      return res.status(400).json({
        message: "Senha do administrador deve ter no mínimo 6 caracteres.",
      });
    }

    try {
      await auth.getUserByEmail(adminEmailValidation.normalizedEmail);
      return res.status(409).json({ message: "Este email já está em uso." });
    } catch (err: unknown) {
      if (
        !err ||
        typeof err !== "object" ||
        !("code" in err) ||
        (err as { code: string }).code !== "auth/user-not-found"
      ) {
        throw err;
      }
    }

    const tenantRef = db.collection("tenants").doc();
    const tenantId = tenantRef.id;
    const now = Timestamp.now();
    const nowIso = now.toDate().toISOString();
    const normalizedPlanId = planId || "free";
    const isManualSubscription = normalizedPlanId !== "free";
    const subscriptionStatus = String(
      body.subscriptionStatus || (isManualSubscription ? "active" : "active"),
    )
      .trim()
      .toLowerCase();

    const adminAuth = await auth.createUser({
      email: adminEmailValidation.normalizedEmail,
      password: adminPassword,
      displayName: adminName,
      emailVerified: false,
    });
    createdAuthUid = adminAuth.uid;

    await auth.setCustomUserClaims(adminAuth.uid, {
      role: "ADMIN",
      tenantId,
    });

    await db.runTransaction(async (transaction) => {
      transaction.set(tenantRef, {
        tenantId,
        name: tenantName,
        slug: sanitizeSlug(body.slug || tenantName),
        primaryColor: String(body.primaryColor || "#3b82f6"),
        logoUrl: String(body.logoUrl || ""),
        niche: String(body.niche || ""),
        whatsappEnabled: body.whatsappEnabled === true,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      const companyRef = db.collection("companies").doc(tenantId);
      transaction.set(
        companyRef,
        {
          id: tenantId,
          tenantId,
          companyName: tenantName,
          name: tenantName,
          primaryColor: String(body.primaryColor || "#3b82f6"),
          logoUrl: String(body.logoUrl || ""),
          niche: String(body.niche || ""),
          whatsappEnabled: body.whatsappEnabled === true,
          usage: {
            users: 0,
            products: 0,
            clients: 0,
            proposals: 0,
          },
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        { merge: true },
      );

      const userRef = db.collection("users").doc(adminAuth.uid);
      transaction.set(userRef, {
        name: adminName,
        email: adminEmailValidation.normalizedEmail,
        phoneNumber: normalizePhoneNumber(body.adminPhoneNumber) || null,
        role: "admin",
        tenantId,
        companyId: tenantId,
        planId: normalizedPlanId,
        subscriptionStatus,
        currentPeriodEnd: body.currentPeriodEnd || null,
        isManualSubscription,
        usage: {
          users: 0,
          products: 0,
          clients: 0,
          proposals: 0,
        },
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      await upsertPhoneNumberIndexTx(transaction, {
        userId: adminAuth.uid,
        tenantId,
        newPhoneNumber: body.adminPhoneNumber,
        now,
      });
    });

    return res.status(201).json({
      success: true,
      tenantId,
      adminUserId: adminAuth.uid,
      message: "Empresa e administrador criados com sucesso.",
    });
  } catch (error: unknown) {
    if (createdAuthUid) {
      try {
        await auth.deleteUser(createdAuthUid);
      } catch (rollbackError) {
        console.error(
          "[createTenant] rollback auth delete failed:",
          rollbackError,
        );
      }
    }
    console.error("[createTenant] error:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao criar empresa.";
    return res.status(500).json({ message });
  }
};

export const deleteTenant = async (req: Request, res: Response) => {
  try {
    if (!isSuperAdminClaim(req)) {
      return res.status(403).json({
        message:
          "Permissão negada. Apenas super admins podem remover empresas.",
      });
    }

    const tenantId = String(req.params.tenantId || "").trim();
    if (!tenantId) {
      return res.status(400).json({ message: "tenantId é obrigatório." });
    }

    const userSnaps = await Promise.all([
      db.collection("users").where("tenantId", "==", tenantId).get(),
      db.collection("users").where("companyId", "==", tenantId).get(),
    ]);

    const uniqueUsers = new Map<string, FirebaseFirestore.DocumentSnapshot>();
    userSnaps.forEach((snap) => {
      snap.docs.forEach((docSnap) => uniqueUsers.set(docSnap.id, docSnap));
    });

    for (const [uid, userSnap] of uniqueUsers) {
      const userRef = db.collection("users").doc(uid);
      await deleteSubcollectionInBatches(userRef, "permissions");

      const userData = userSnap.data() as { phoneNumber?: string } | undefined;
      const normalizedPhone = normalizePhoneNumber(userData?.phoneNumber);
      if (normalizedPhone) {
        const phoneRef = db.collection("phoneNumberIndex").doc(normalizedPhone);
        const phoneSnap = await phoneRef.get();
        const phoneData = phoneSnap.data() as { userId?: string } | undefined;
        if (phoneSnap.exists && phoneData?.userId === uid) {
          await phoneRef.delete();
        }
      }

      try {
        await auth.deleteUser(uid);
      } catch (err: unknown) {
        if (
          !err ||
          typeof err !== "object" ||
          !("code" in err) ||
          (err as { code: string }).code !== "auth/user-not-found"
        ) {
          throw err;
        }
      }

      await userRef.delete();
    }

    const tenantCollections = [
      "products",
      "services",
      "proposals",
      "custom_options",
      "custom_fields",
      "options",
      "clients",
      "transactions",
      "wallets",
      "wallet_transactions",
      "notifications",
      "addons",
      "purchased_addons",
      "spreadsheets",
      "proposal_templates",
      "sistemas",
      "ambientes",
    ];

    for (const collectionName of tenantCollections) {
      await deleteQueryInBatches(
        db.collection(collectionName).where("tenantId", "==", tenantId),
      );
    }

    await db.collection("companies").doc(tenantId).delete();
    await db.collection("tenants").doc(tenantId).delete();

    return res.json({
      success: true,
      message: "Empresa removida com sucesso.",
    });
  } catch (error: unknown) {
    console.error("[deleteTenant] error:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao remover empresa.";
    return res.status(500).json({ message });
  }
};

import { reportWhatsAppOverage } from "../../services/whatsappBilling";

export const testWhatsAppBilling = async (req: Request, res: Response) => {
  try {
    const { tenantId, month } = req.body;

    if (!isSuperAdminClaim(req)) {
      return res.status(403).json({
        message: "Permissão negada. Apenas super admins podem testar billing.",
      });
    }

    if (!tenantId || !month) {
      return res
        .status(400)
        .json({ message: "tenantId e month são obrigatórios" });
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

export const copyTenantData = async (req: Request, res: Response) => {
  try {
    if (!isSuperAdminClaim(req)) {
      return res.status(403).json({
        message: "Permissão negada. Apenas super admins podem copiar dados de tenants.",
      });
    }

    const { sourceTenantId, targetTenantId } = req.body;

    if (!sourceTenantId || !targetTenantId) {
      return res.status(400).json({ message: "sourceTenantId e targetTenantId são obrigatórios." });
    }

    const collectionsToCopy = ["products", "services", "sistemas", "ambientes"];
    const now = Timestamp.now();
    const nowTimestampStr = now.toDate().toISOString();

    let totalCopied = 0;

    for (const collectionName of collectionsToCopy) {
      const sourceQuery = db.collection(collectionName).where("tenantId", "==", sourceTenantId);
      const snapshot = await sourceQuery.get();

      if (snapshot.empty) continue;

      const batches: FirebaseFirestore.WriteBatch[] = [];
      let currentBatch = db.batch();
      let operationCount = 0;

      snapshot.docs.forEach((docSnap) => {
        if (operationCount === 500) {
          batches.push(currentBatch);
          currentBatch = db.batch();
          operationCount = 0;
        }

        const data = docSnap.data();
        const newRef = db.collection(collectionName).doc();

        const newData: any = {
          ...data,
          tenantId: targetTenantId,
          companyId: targetTenantId, // Legacy fallback
          createdAt: data.createdAt || nowTimestampStr, // Keep original creation date or set new
          updatedAt: nowTimestampStr,
        };

        // Ensure internal IDs match the new document ID if they exist
        if (typeof data.id === 'string') newData.id = newRef.id;
        if (typeof data.productId === 'string') newData.productId = newRef.id;
        if (typeof data.serviceId === 'string') newData.serviceId = newRef.id;
        if (typeof data.sistemaId === 'string') newData.sistemaId = newRef.id;
        if (typeof data.ambienteId === 'string') newData.ambienteId = newRef.id;

        currentBatch.set(newRef, newData);
        operationCount++;
        totalCopied++;
      });

      if (operationCount > 0) {
        batches.push(currentBatch);
      }

      for (const batch of batches) {
        await batch.commit();
      }
    }

    return res.json({
      success: true,
      message: `Cópia concluída. ${totalCopied} registros copiados com sucesso.`,
      totalCopied,
    });
  } catch (error: unknown) {
    console.error("[copyTenantData] error:", error);
    const message = error instanceof Error ? error.message : "Erro ao copiar dados do tenant.";
    return res.status(500).json({ message });
  }
};
