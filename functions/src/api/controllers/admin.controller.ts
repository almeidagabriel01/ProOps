import { Request, Response } from "express";
import { db, auth } from "../../init";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  canManageTeam,
  generateRandomPassword,
  isValidEmail,
} from "../../lib/admin-helpers";
import { checkUserLimit } from "../../lib/billing-helpers";
import { UserDoc, resolveUserAndTenant } from "../../lib/auth-helpers";

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
      return res.status(400).json({ message: "Email inválido" });
    }

    // Check if logged user is super admin
    const loggedUserSnap = await db.collection("users").doc(loggedUserId).get();
    const loggedUserData = loggedUserSnap.data() as UserDoc | undefined;
    const isSuperAdmin = loggedUserData?.role?.toUpperCase() === "SUPERADMIN";

    // Super admin can specify a target master, otherwise use logged user
    const masterId =
      isSuperAdmin && input.targetMasterId
        ? input.targetMasterId
        : loggedUserId;

    const masterRef = db.collection("users").doc(masterId);
    const masterSnap = await masterRef.get();

    if (!masterSnap.exists) {
      return res.status(404).json({ message: "Usuário master não encontrado" });
    }

    const masterData = masterSnap.data() as UserDoc;
    const role = masterData.role?.toUpperCase();

    // Skip role check for super admin
    if (!isSuperAdmin && !canManageTeam(role) && role !== "MASTER") {
      return res.status(403).json({
        message: "Apenas administradores podem criar membros da equipe",
      });
    }

    const tenantId = masterData.tenantId || masterData.companyId;

    if (!tenantId) {
      return res.status(412).json({
        message: "Erro na conta: Identificador do tenant não encontrado.",
      });
    }

    // Limit Check - Skip for super admin
    if (!isSuperAdmin) {
      try {
        await checkUserLimit(masterData, masterId);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Erro desconhecido";
        return res.status(402).json({ message, code: "resource-exhausted" });
      }
    }

    // Check Email in Auth
    try {
      await auth.getUserByEmail(input.email);
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
        email: input.email,
        password: password,
        displayName: input.name,
        emailVerified: false,
      });
    } catch (err) {
      console.error("Error creating Auth user:", err);
      return res.status(500).json({ message: "Erro ao criar usuário." });
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

    const [masterSnap, memberSnap] = await Promise.all([
      db.collection("users").doc(masterId).get(),
      db.collection("users").doc(id).get(),
    ]);

    if (!masterSnap.exists)
      return res.status(404).json({ message: "Usuário master não encontrado" });
    if (!memberSnap.exists)
      return res.status(404).json({ message: "Membro não encontrado" });

    const masterData = masterSnap.data() as UserDoc;
    const memberData = memberSnap.data();

    if (!canManageTeam(masterData.role))
      return res.status(403).json({ message: "Permissão negada." });
    if (memberData?.masterId !== masterId)
      return res.status(403).json({ message: "Permissão negada." });

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

    const [loggedUserSnap, memberSnap] = await Promise.all([
      db.collection("users").doc(loggedUserId).get(),
      db.collection("users").doc(id).get(),
    ]);

    if (!loggedUserSnap.exists)
      return res.status(404).json({ message: "Usuário não encontrado" });
    if (!memberSnap.exists)
      return res.status(404).json({ message: "Membro não encontrado" });

    const loggedUserData = loggedUserSnap.data() as UserDoc;
    const memberData = memberSnap.data();
    const isSuperAdmin = loggedUserData.role?.toUpperCase() === "SUPERADMIN";

    // Super admin can delete any member; otherwise check permissions
    if (!isSuperAdmin) {
      if (!canManageTeam(loggedUserData.role))
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
  console.log("=== [updatePermissions] START ===");
  console.log(
    "[updatePermissions] Full body:",
    JSON.stringify(req.body, null, 2),
  );

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

    const [masterSnap, memberSnap] = await Promise.all([
      db.collection("users").doc(masterId).get(),
      db.collection("users").doc(actualMemberId).get(),
    ]);

    console.log(
      "[updatePermissions] masterSnap.exists:",
      masterSnap.exists,
      "memberSnap.exists:",
      memberSnap.exists,
    );

    if (!masterSnap.exists) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }
    if (!memberSnap.exists) {
      console.log(
        "[updatePermissions] Member not found with ID:",
        actualMemberId,
      );
      return res.status(404).json({ message: "Membro não encontrado." });
    }

    const masterData = masterSnap.data() as UserDoc;
    const memberData = memberSnap.data();

    if (!canManageTeam(masterData.role)) {
      return res.status(403).json({ message: "Permissão negada." });
    }
    if (memberData?.masterId !== masterId) {
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
      [key: string]: unknown;
    }

    const userId = req.user!.uid;
    const { isSuperAdmin } = await resolveUserAndTenant(userId, req.user);

    if (!isSuperAdmin) {
      return res.status(403).json({ message: "Acesso negado." });
    }

    // Busca usuários MASTER/admin (donos de empresa)
    const usersSnapshot = await db
      .collection("users")
      .where("role", "in", ["MASTER", "admin", "ADMIN", "master"])
      .get();

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

    // Mapeia para TenantBillingInfo
    const tenantsData = await Promise.all(
      usersSnapshot.docs.map(async (userDoc) => {
        const userData = userDoc.data() as BillingUserData;
        const tenantId = userData.tenantId || userData.companyId;

        // Busca dados do tenant
        interface TenantData {
          name?: string;
          slug?: string;
          createdAt?: string;
          logoUrl?: string;
          primaryColor?: string;
          niche?: string;
          whatsappEnabled?: boolean;
        }
        let tenantData: TenantData = {};
        if (tenantId) {
          const tenantSnap = await db.collection("tenants").doc(tenantId).get();
          if (tenantSnap.exists) {
            tenantData = (tenantSnap.data() as TenantData) || {};
          }
        }

        // Determina nome do plano
        const planId = String(userData.planId || "free");
        const tierToName: Record<string, string> = {
          free: "Gratuito",
          starter: "Starter",
          pro: "Pro",
          enterprise: "Enterprise",
        };

        // Se planId é um tier conhecido, usa direto. Senão, busca o documento do plano
        let planName = tierToName[planId.toLowerCase()];
        if (!planName && planId !== "free") {
          try {
            const planSnap = await db.collection("plans").doc(planId).get();
            if (planSnap.exists) {
              const planData = planSnap.data();
              planName = tierToName[planData?.tier] || planData?.name || planId;
            } else {
              planName = planId;
            }
          } catch {
            planName = planId;
          }
        }

        const effectiveStatus = deriveTenantStatus(userData);

        return {
          tenant: {
            id: tenantId || userDoc.id,
            name: tenantData.name || userData.companyName || "Sem nome",
            slug: tenantData.slug,
            createdAt: tenantData.createdAt || userData.createdAt,
            logoUrl: tenantData.logoUrl,
            primaryColor: tenantData.primaryColor,
            niche: tenantData.niche,
            whatsappEnabled: tenantData.whatsappEnabled,
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
        };
      }),
    );

    return res.json(tenantsData);
  } catch (error: unknown) {
    console.error("Error getting tenants:", error);
    return res.status(500).json({ message: "Erro ao buscar tenants." });
  }
};

export const updateCredentials = async (req: Request, res: Response) => {
  try {
    const loggedUserId = req.user!.uid;
    const { userId, email, password, phoneNumber } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "ID do usuário é obrigatório" });
    }

    // Verify Super Admin
    const loggedUserSnap = await db.collection("users").doc(loggedUserId).get();
    const loggedUserData = loggedUserSnap.data() as UserDoc | undefined;
    const isSuperAdmin = loggedUserData?.role?.toUpperCase() === "SUPERADMIN";

    if (!isSuperAdmin) {
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
    const loggedUserId = req.user!.uid;
    const { userId } = req.params;
    const { planId } = req.body;

    if (!userId || !planId) {
      return res
        .status(400)
        .json({ message: "ID do usuário e Plan ID são obrigatórios" });
    }

    // Verify Super Admin
    const loggedUserSnap = await db.collection("users").doc(loggedUserId).get();
    const loggedUserData = loggedUserSnap.data() as UserDoc | undefined;
    const isSuperAdmin = loggedUserData?.role?.toUpperCase() === "SUPERADMIN";

    if (!isSuperAdmin) {
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
    const loggedUserId = req.user!.uid;
    const { userId } = req.params;
    const updates = req.body;

    if (!userId) {
      return res.status(400).json({ message: "ID do usuário é obrigatório" });
    }

    // Verify Super Admin
    const loggedUserSnap = await db.collection("users").doc(loggedUserId).get();
    const loggedUserData = loggedUserSnap.data() as UserDoc | undefined;
    const isSuperAdmin = loggedUserData?.role?.toUpperCase() === "SUPERADMIN";

    if (!isSuperAdmin) {
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

import { reportWhatsAppOverage } from "../../services/whatsappBilling";

export const testWhatsAppBilling = async (req: Request, res: Response) => {
  try {
    const loggedUserId = req.user!.uid;
    const { tenantId, month } = req.body;

    // Verify Super Admin
    const loggedUserSnap = await db.collection("users").doc(loggedUserId).get();
    const loggedUserData = loggedUserSnap.data() as UserDoc | undefined;
    const isSuperAdmin = loggedUserData?.role?.toUpperCase() === "SUPERADMIN";

    if (!isSuperAdmin) {
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
