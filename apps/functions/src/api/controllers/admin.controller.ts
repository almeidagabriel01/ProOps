import { Request, Response } from "express";
import { db, auth } from "../../init";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "node:crypto";
import { generateRandomPassword } from "../../lib/admin-helpers";
import {
  UserDoc,
  normalizePagePermission,
} from "../../lib/auth-helpers";
import { isSuperAdminClaim, isTenantAdminClaim } from "../../lib/request-auth";
import { authorizeMfaReset } from "../../lib/mfa-reset-authz";
import { clearUserMfaFactors } from "../../lib/mfa-reset";
import { logger } from "../../lib/logger";
import { fetchAuditEvents } from "../../lib/audit-events-query";
import {
  incrementSecurityCounter,
  resolveSecurityAuditCollection,
  writeSecurityAuditEvent,
} from "../../lib/security-observability";
import { assertTenantExists } from "../../lib/tenant-resolution";
import {
  buildManualSubscriptionUpdate,
  deriveManualStatusFromPeriodEnd,
  isStripeManagedBilling,
} from "../../lib/admin-billing-guards";
import { auditAdminAction } from "../../lib/admin-audit";
import {
  buildPurgeStages,
  TENANT_PURGE_JOBS_COLLECTION,
} from "../services/tenant-purge.service";
import { enqueueTenantSync } from "../../billing";
import { deriveSubscriptionDisplayStatus } from "../../shared/subscription-status";
import {
  buildPublicPlanFeatures,
  type PublicPlanFeatures,
} from "../../shared/plan-capabilities";
import {
  clearTenantPlanCache,
  enforceTenantPlanLimit,
  getTenantPlanProfile,
  getTenantUsersUsage,
  normalizePlanTier,
} from "../../lib/tenant-plan-policy";
import {
  normalizeBrazilPhoneNumber,
  validateBrazilMobilePhone,
  validateEmailForSignup,
} from "../../lib/contact-validation";
import {
  maybeAutoEnableWhatsApp,
  tenantPlanAllowsWhatsApp,
} from "../../lib/whatsapp-eligibility";
import { syncTenantPlanBillingSnapshot } from "../../stripe/stripeWebhook";
import { getStripe } from "../../stripe/stripeConfig";
import { detectPriceDrift } from "../../billing/price-drift";

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
          onboarding: {
            version: "core-v1",
            status: "active",
            completedStepIds: [],
            currentStepId: "dashboard",
            startedAt: now.toDate().toISOString(),
            updatedAt: now.toDate().toISOString(),
          },
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
            ...normalizePagePermission(permData),
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

      if (input.phoneNumber) {
        maybeAutoEnableWhatsApp(tenantId).catch((err) =>
          logger.warn("whatsapp auto-enable failed on member create", {
            tenantId,
            err: String(err),
          }),
        );
      }

      if (isSuperAdmin) {
        await auditAdminAction(req, "super_admin_member_created", {
          tenantId,
          targetId: memberId,
        });
      }

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

    const memberTenantId = String(
      memberData?.tenantId || memberData?.companyId || "",
    ).trim();
    if (phoneNumber && memberTenantId) {
      maybeAutoEnableWhatsApp(memberTenantId).catch((err) =>
        logger.warn("whatsapp auto-enable failed on member update", {
          tenantId: memberTenantId,
          err: String(err),
        }),
      );
    }

    if (isSuperAdmin) {
      await auditAdminAction(req, "super_admin_member_updated", {
        tenantId: String(memberData?.tenantId || ""),
        targetId: id,
      });
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

    if (isSuperAdmin) {
      await writeSecurityAuditEvent({
        eventType: "super_admin_destructive_op",
        uid: loggedUserId,
        tenantId,
        route: req.originalUrl || req.path,
        requestId: req.requestId,
        reason: `deleteMember:${id}`,
        source: "admin_controller",
      });
    }

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

    if (!actualMemberId) {
      return res.status(400).json({ message: "ID do membro é obrigatório." });
    }

    const memberSnap = await db.collection("users").doc(actualMemberId).get();

    if (!memberSnap.exists) {
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
    // Cross-check: member must belong to the same tenant as the requester
    if (!isSuperAdmin && memberData?.tenantId !== req.user!.tenantId) {
      logger.warn("updatePermissions cross-tenant attempt blocked", {
        requesterId: masterId,
        requesterTenantId: req.user!.tenantId,
        memberTenantId: memberData?.tenantId,
        memberId: actualMemberId,
      });
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
          ...normalizePagePermission({
            canView: existingData?.canView ?? false,
            canCreate: existingData?.canCreate ?? false,
            canEdit: existingData?.canEdit ?? false,
            canDelete: existingData?.canDelete ?? false,
            [key]: value,
          }),
          updatedAt: new Date().toISOString(),
          updatedBy: masterId,
        },
        { merge: true },
      );

      if (isSuperAdmin) {
        await auditAdminAction(req, "super_admin_permissions_updated", {
          tenantId: String(memberData?.tenantId || ""),
          targetId: actualMemberId,
          reason: `single:${pageId}.${key}=${value}`,
        });
      }
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
        ...normalizePagePermission(p),
        updatedAt: new Date().toISOString(),
        updatedBy: masterId,
      });
    }

    await batch.commit();
    if (isSuperAdmin) {
      await auditAdminAction(req, "super_admin_permissions_updated", {
        tenantId: String(memberData?.tenantId || ""),
        targetId: actualMemberId,
        reason: "bulk",
      });
    }
    return res.json({ success: true, message: "Permissões atualizadas." });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ message });
  }
};

/**
 * Resets (removes) a user's enrolled MFA factors via the Admin SDK.
 * Recovery path for users who lost their authenticator app — Firebase TOTP has
 * no native backup codes. Authorized for super admins (any user) or tenant
 * admins (members of their own tenant only).
 */
export const resetMemberMfa = async (req: Request, res: Response) => {
  try {
    const requesterUid = req.user!.uid;
    const targetUid = req.params.uid;

    if (!targetUid || typeof targetUid !== "string") {
      return res.status(400).json({ message: "ID do usuário é obrigatório." });
    }

    const targetSnap = await db.collection("users").doc(targetUid).get();
    const targetData = targetSnap.data();
    const isSuperAdmin = isSuperAdminClaim(req);

    const authz = authorizeMfaReset({
      isSuperAdmin,
      isTenantAdmin: isTenantAdminClaim(req),
      requesterUid,
      requesterTenantId: req.user!.tenantId,
      target: {
        exists: targetSnap.exists,
        tenantId: targetData?.tenantId,
        masterId: targetData?.masterId,
      },
    });

    if (!authz.allowed) {
      if (authz.crossTenant) {
        logger.warn("resetMemberMfa cross-tenant attempt blocked", {
          requesterId: requesterUid,
          requesterTenantId: req.user!.tenantId,
          targetTenantId: targetData?.tenantId,
          targetUid,
        });
      }
      return res.status(authz.status).json({ message: authz.message });
    }

    await clearUserMfaFactors(targetUid);

    await writeSecurityAuditEvent({
      eventType: "mfa_reset_by_admin",
      uid: requesterUid,
      tenantId: targetData?.tenantId,
      eventId: targetUid,
      route: req.path,
      reason: isSuperAdmin ? "superadmin" : "tenant_admin",
    });

    logger.info("MFA reset by admin", {
      requesterId: requesterUid,
      targetUid,
      isSuperAdmin,
      tenantId: targetData?.tenantId,
    });

    return res.json({
      success: true,
      message: "Verificação em dois fatores redefinida.",
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    logger.error("resetMemberMfa failed", { message });
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
      accountStatus?: string;
      lastSeenAt?: string;
      slug?: string;
      createdAt?: string;
      logoUrl?: string;
      primaryColor?: string;
      niche?: string;
      whatsappEnabled?: boolean;
      plan?: string;
      subscriptionStatus?: string;
      currentPeriodEnd?: string;
      cancelAtPeriodEnd?: boolean;
      billingSyncedAt?: string;
      unitAmount?: number | null;
      currency?: string | null;
      stripeSubscriptionId?: string | null;
      priceChangeNotifiedFor?: string | null;
      subscription?: {
        unitAmount?: number | null;
        currency?: string | null;
        [key: string]: unknown;
      };
    }

    const cursor = String(req.query.cursor || "").trim() || null;
    const pageSize = Math.min(Number(req.query.pageSize) || 25, 100);
    // Busca por empresas especificas (busca global do painel, fallback do
    // TenantProvider). Ate 30 ids: o limite do operador `in` do Firestore.
    const requestedTenantIds = String(req.query.tenantIds || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 30);

    let docs: FirebaseFirestore.QueryDocumentSnapshot[];
    let hasMore = false;
    let nextCursor: string | null = null;

    if (requestedTenantIds.length > 0) {
      const byTenant = await db
        .collection("users")
        .where("tenantId", "in", requestedTenantIds)
        .limit(300)
        .get();
      const ownerRoles = new Set(["master", "admin", "free"]);
      docs = byTenant.docs.filter(
        (d) =>
          !String(d.get("masterId") || "").trim() &&
          ownerRoles.has(String(d.get("role") || "").toLowerCase()),
      );
    } else {
      // Busca usuários MASTER/admin/free (donos de empresa ou contas gratuitas)
      let usersQuery: FirebaseFirestore.Query = db
        .collection("users")
        .where("role", "in", ["MASTER", "admin", "ADMIN", "master", "free"])
        .orderBy("createdAt", "desc")
        .limit(pageSize + 1);

      if (cursor) {
        const cursorSnap = await db.collection("users").doc(cursor).get();
        if (cursorSnap.exists) {
          usersQuery = usersQuery.startAfter(cursorSnap);
        }
      }

      const usersSnapshot = await usersQuery.get();
      hasMore = usersSnapshot.docs.length > pageSize;
      docs = hasMore ? usersSnapshot.docs.slice(0, pageSize) : usersSnapshot.docs;
      nextCursor = hasMore ? docs[docs.length - 1].id : null;
    }

    logger.info("[getAllTenantsBilling] found users", {
      count: docs.length,
      hasMore,
      cursor: cursor || undefined,
    });

    // Collect unique tenant IDs and plan IDs for batch fetch
    const tenantIds = new Set<string>();
    const planIds = new Set<string>();
    const tierToName: Record<string, string> = {
      free: "Gratuito",
      starter: "Starter",
      pro: "Pro",
      enterprise: "Enterprise",
    };

    for (const userDoc of docs) {
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
    const planFeaturesMap = new Map<string, Record<string, unknown>>();
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
            if (planData?.features) {
              planFeaturesMap.set(snap.id, planData.features as Record<string, unknown>);
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

    // Batch count queries for extended usage (transactions, wallets, calendar_events)
    const usageCountsMap = new Map<string, { transactions: number; wallets: number; calendarEvents: number }>();
    try {
      const uniqueTenantIds = Array.from(tenantIds);
      await Promise.all(
        uniqueTenantIds.map(async (tenantId) => {
          const [txSnap, walletSnap, calSnap] = await Promise.all([
            db.collection("transactions").where("tenantId", "==", tenantId).count().get(),
            db.collection("wallets").where("tenantId", "==", tenantId).count().get(),
            db.collection("calendar_events").where("tenantId", "==", tenantId).count().get(),
          ]);
          usageCountsMap.set(tenantId, {
            transactions: txSnap.data().count,
            wallets: walletSnap.data().count,
            calendarEvents: calSnap.data().count,
          });
        })
      );
    } catch (error) {
      logger.error("Failed to fetch extended usage counts", { error });
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

    // Display status derived from the USER doc, used only as a fallback when the
    // tenant doc carries no billing fields (legacy tenants). Delegates to the
    // single shared deriveSubscriptionDisplayStatus so every read path agrees.
    const deriveUserDocStatus = (userData: BillingUserData): string => {
      const periodEnd =
        parsePeriodEnd(userData.currentPeriodEnd) ||
        parsePeriodEnd(userData.subscription?.currentPeriodEnd);
      return deriveSubscriptionDisplayStatus({
        planId: userData.planId,
        storedStatus:
          normalizeStatus(userData.subscriptionStatus) ||
          normalizeStatus(userData.subscription?.status),
        cancelAtPeriodEnd: Boolean(
          userData.cancelAtPeriodEnd ||
            userData.subscription?.cancelAtPeriodEnd ||
            userData.subscription?.cancel_at_period_end,
        ),
        currentPeriodEnd: periodEnd ? periodEnd.toISOString() : null,
      });
    };

    // Derivado do catalogo. Enquanto era uma tabela literal, o painel de billing
    // do superadmin mostrava `free.maxProposals: 15` contra os 5 que o
    // enforcement realmente aplica — o numero exibido para diagnosticar um
    // tenant nao era o numero que o bloqueava.
    const TIER_DEFAULT_FEATURES: Record<string, PublicPlanFeatures> = {
      free: buildPublicPlanFeatures("free"),
      starter: buildPublicPlanFeatures("starter"),
      pro: buildPublicPlanFeatures("pro"),
      enterprise: buildPublicPlanFeatures("enterprise"),
    };

    // Process all users synchronously using pre-fetched data
    const tenantsData = [];
    // Uma linha por empresa: empresa com dois admins sem masterId aparecia duas vezes.
    const seenTenantIds = new Set<string>();
    for (const userDoc of docs) {
      try {
        const userData = userDoc.data() as BillingUserData;
        const tenantId = userData.tenantId || userData.companyId;
        if (tenantId) {
          if (seenTenantIds.has(tenantId)) continue;
          seenTenantIds.add(tenantId);
        }
        const tenantData = (tenantId && tenantDataMap.get(tenantId)) || {} as TenantData;

        // O plano exibido e o que o backend usa para liberar modulo
        // (`tenants.plan`, escrito pelo writer unico). O `users.planId` fica de
        // fallback para empresa legada: os dois podem divergir, e mostrar o do
        // usuario fazia o painel dizer Enterprise para quem levava 402.
        const rawPlanId = String(tenantData.plan || userData.planId || "free");
        // Normalize planId to tier name: if it's a document ID, resolve to tier; otherwise use as-is
        const planId = tierToName[rawPlanId.toLowerCase()]
          ? rawPlanId.toLowerCase()
          : planTierMap.get(rawPlanId) || rawPlanId.toLowerCase();
        let planName = tierToName[planId.toLowerCase()];
        if (!planName && planId !== "free") {
          planName = planNameMap.get(planId) || planId;
        }

        // Authoritative billing comes from the tenant doc (single writer: the
        // Stripe webhook / billing sync). Derive the DISPLAY status from it via
        // the shared, time-aware function. Fall back to the user doc only for
        // legacy tenants whose tenant doc has no billing fields yet.
        // Authoritative only when the tenant doc actually carries a status — a
        // billingSyncedAt-only write (free/no-customer sync) must NOT shadow the
        // richer user-doc data via an empty status.
        const tenantHasBilling =
          typeof tenantData.subscriptionStatus === "string" &&
          tenantData.subscriptionStatus.trim() !== "";
        // Defensive: tenant docs store ISO strings, but parse through the same
        // helper as the user-doc path so a stray Firestore Timestamp can't make
        // the period-lapse check silently no-op.
        const tenantPeriodEnd = parsePeriodEnd(tenantData.currentPeriodEnd);
        const displayStatus = tenantHasBilling
          ? deriveSubscriptionDisplayStatus({
              // Use the tenant doc's own plan tier so this matches the onSnapshot
              // derivation exactly; fall back to the user-doc tier if absent.
              planId: tenantData.plan ?? planId,
              storedStatus: tenantData.subscriptionStatus,
              cancelAtPeriodEnd: tenantData.cancelAtPeriodEnd,
              currentPeriodEnd: tenantPeriodEnd ? tenantPeriodEnd.toISOString() : null,
            })
          : deriveUserDocStatus(userData);

        // Raw status kept on the admin sub-object for reference/debugging.
        const tenantSubscriptionStatus =
          tenantData.subscriptionStatus || userData.subscriptionStatus || "";
        const tenantCurrentPeriodEnd = tenantData.currentPeriodEnd || userData.currentPeriodEnd;

        // Listar nao dispara mais sync com o Stripe. Antes, todo tenant pago
        // sincronizado ha mais de 5 min contava como desatualizado, entao cada
        // visita ao painel chamava a API do Stripe para quase todas as empresas,
        // sem await (o Cloud Run congela e o sync se perde). O cron diario
        // `checkStripeSubscriptions` e o botao "Sincronizar" cobrem isso.
        const isBillingStale = false;

        tenantsData.push({
          tenant: {
            id: tenantId || userDoc.id,
            name: tenantData.name || userData.companyName || "Sem nome",
            slug: tenantData.slug,
            createdAt: tenantData.createdAt || userData.createdAt,
            logoUrl: tenantData.logoUrl,
            primaryColor: tenantData.primaryColor,
            niche: tenantData.niche,
            whatsappEnabled: tenantData.whatsappEnabled,
            accountStatus: tenantData.accountStatus || "active",
            lastSeenAt: tenantData.lastSeenAt,
          },
          admin: {
            id: userDoc.id,
            name: userData.name || userData.displayName || "",
            email: userData.email || "",
            phoneNumber: userData.phoneNumber,
            subscriptionStatus: tenantSubscriptionStatus,
            currentPeriodEnd: tenantCurrentPeriodEnd,
            subscription: userData.subscription,
          },
          planName: planName || planId,
          planId,
          subscriptionStatus: displayStatus,
          billingInterval: String(userData.billingInterval || "monthly"),
          planFeatures: planFeaturesMap.get(rawPlanId) || TIER_DEFAULT_FEATURES[planId] || undefined,
          unitAmount: tenantData?.unitAmount ?? tenantData?.subscription?.unitAmount ?? null,
          currency: tenantData?.currency ?? tenantData?.subscription?.currency ?? "brl",
          stripeSubscriptionId: tenantData?.stripeSubscriptionId ?? null,
          billingManagedBy: isStripeManagedBilling(
            tenantData as Record<string, unknown>,
            userData as Record<string, unknown>,
          )
            ? "stripe"
            : "manual",
          priceChangeNotifiedFor: tenantData?.priceChangeNotifiedFor ?? null,
          isBillingStale,
          usage: {
            users: userData.usage?.users || 0,
            proposals: userData.usage?.proposals || 0,
            clients: userData.usage?.clients || 0,
            products: userData.usage?.products || 0,
            transactions: usageCountsMap.get(tenantId ?? "")?.transactions ?? 0,
            wallets: usageCountsMap.get(tenantId ?? "")?.wallets ?? 0,
            calendarEvents: usageCountsMap.get(tenantId ?? "")?.calendarEvents ?? 0,
          },
        });
      } catch (docErr) {
        logger.error("[getAllTenantsBilling] error processing user doc", {
          docId: userDoc.id,
          error: docErr instanceof Error ? docErr.message : String(docErr),
        });
      }
    }

    logger.info("[getAllTenantsBilling] returning tenants", { count: tenantsData.length, hasMore });
    return res.json({ items: tenantsData, nextCursor, hasMore });
  } catch (error: unknown) {
    console.error("Error getting tenants:", error);
    return res.status(500).json({ message: "Erro ao buscar tenants." });
  }
};

export const syncTenantBilling = async (req: Request, res: Response) => {
  try {
    if (!isSuperAdminClaim(req)) {
      return res.status(403).json({ message: "Acesso negado." });
    }
    const { tenantId } = req.params;
    if (!tenantId || !tenantId.trim()) {
      return res.status(400).json({ message: "tenantId obrigatório." });
    }
    const snapshot = await enqueueTenantSync(tenantId, "manual");
    return res.status(200).json({ ok: true, snapshot });
  } catch (err) {
    logger.error("[syncTenantBilling] error", {
      tenantId: req.params.tenantId,
      error: err instanceof Error ? err.message : String(err),
    });
    return res.status(500).json({ message: "Erro ao sincronizar billing." });
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

    const targetSnap = await db.collection("users").doc(String(userId)).get();
    if (!targetSnap.exists) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }
    const targetRole = String(targetSnap.get("role") || "").trim().toUpperCase();
    // Trocar a senha de outro superadmin daria acesso ao painel inteiro com a
    // conta dele, sem o segundo fator ter sido quebrado.
    if (targetRole === "SUPERADMIN") {
      return res.status(403).json({
        message: "Credenciais de super admin não podem ser alteradas pelo painel.",
      });
    }

    let normalizedEmail: string | undefined;
    if (email) {
      const emailValidation = await validateEmailForSignup(String(email));
      if (!emailValidation.valid) {
        return res
          .status(400)
          .json({ message: emailValidation.reason || "Email inválido." });
      }
      normalizedEmail = emailValidation.normalizedEmail;
    }

    if (password && String(password).length < 6) {
      return res
        .status(400)
        .json({ message: "A senha deve ter no mínimo 6 caracteres." });
    }

    const updateData: { email?: string; password?: string } = {};
    if (normalizedEmail) updateData.email = normalizedEmail;
    if (password) updateData.password = String(password);

    if (Object.keys(updateData).length > 0) {
      try {
        await auth.updateUser(userId, updateData);
      } catch (err: unknown) {
        if ((err as { code?: string })?.code === "auth/email-already-exists") {
          return res.status(409).json({ message: "Este email já está em uso." });
        }
        throw err;
      }
      // Sessoes abertas com a credencial antiga caem na proxima request.
      await auth.revokeRefreshTokens(userId);
    }

    // Update Firestore User
    const firestoreUpdate: Record<string, unknown> = {};
    if (normalizedEmail) firestoreUpdate.email = normalizedEmail;
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

    await auditAdminAction(req, "super_admin_credentials_updated", {
      tenantId: String(targetSnap.get("tenantId") || ""),
      targetId: String(userId),
      reason: [
        normalizedEmail ? "email" : "",
        password ? "password" : "",
        phoneNumber !== undefined ? "phone" : "",
      ]
        .filter(Boolean)
        .join(","),
    });

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

    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    const userData = userSnap.data() as Record<string, unknown>;
    const planTenantId = String(userData?.tenantId || userData?.companyId || "").trim();
    const planTenantData = planTenantId
      ? ((await db.collection("tenants").doc(planTenantId).get()).data() ?? null)
      : null;
    // O webhook do Stripe reescreveria o plano no proximo evento: a troca pelo
    // painel so duraria ate la, com tela, enforcement e fatura discordando.
    if (isStripeManagedBilling(planTenantData, userData)) {
      return res.status(409).json({
        code: "STRIPE_MANAGED_SUBSCRIPTION",
        message:
          "Esta empresa paga pelo Stripe: troque o plano pelo portal de assinatura do cliente.",
      });
    }
    const currentRole = String(userData?.role || "").trim().toLowerCase();
    const hasMasterId = Boolean(String(userData?.masterId || "").trim());
    const tenantId = String(
      userData?.tenantId || userData?.companyId || "",
    ).trim();

    // Promote free account owners to MASTER when a plan is assigned
    const shouldPromote = currentRole === "free" && !hasMasterId;

    const updatePayload: Record<string, unknown> = {
      planId,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (shouldPromote) {
      updatePayload.role = "MASTER";
    }

    await userRef.update(updatePayload);

    if (shouldPromote && tenantId) {
      try {
        const userRecord = await auth.getUser(userId);
        const previousClaims = (userRecord.customClaims || {}) as Record<
          string,
          unknown
        >;
        await auth.setCustomUserClaims(userId, {
          ...previousClaims,
          role: "MASTER",
          tenantId,
        });
      } catch (claimsError) {
        logger.error(
          `[updateUserPlan] Failed to set custom claims for user ${userId}`,
          { userId, error: (claimsError as Error).message },
        );
      }
    }

    // Sync the new planId to the tenant doc and recompute whatsappEnabled.
    if (tenantId) {
      try {
        const tenantRef = db.collection("tenants").doc(tenantId);
        const tierFromPlanId = normalizePlanTier(planId);

        // Read existing tenant doc BEFORE any writes — we need the current
        // subscriptionStatus to pass to the single writer (the writer requires it
        // and we have no Stripe context here). Pattern matches
        // billing-sync.service.ts and stripeHelpers.upsertTenantStripeBillingData.
        const tenantSnap = await tenantRef.get();
        const tenantData = (tenantSnap.data() || {}) as Record<string, unknown>;
        const existingSubscriptionStatus =
          typeof tenantData.subscriptionStatus === "string" &&
          tenantData.subscriptionStatus.trim()
            ? (tenantData.subscriptionStatus as string)
            : "active";

        // (1) Write planId (raw Stripe price-id pointer) directly — NOT a
        // billing-state field per Phase 19 schema. The plan tier is routed
        // through the single writer below.
        await tenantRef.set(
          {
            // EXEMPT: planId is a raw price-id pointer, not a Phase 19 billing-state field
            planId,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

        // (2) Route the plan tier through the single writer. We use
        // tierFromPlanId (= normalizePlanTier(planId), computed at the top of
        // the try block) directly — DO NOT call getTenantPlanProfile here, as
        // it reads tenantData.plan first and would return the STALE tier
        // (the doc has not been updated with the new tier yet). The single
        // writer handles clearTenantPlanCache + whatsappEnabled second-write
        // internally (Pitfall 2) — do NOT duplicate them in this block.
        if (tierFromPlanId) {
          await syncTenantPlanBillingSnapshot({
            tenantId,
            subscriptionStatus: existingSubscriptionStatus,
            plan: tierFromPlanId,
            source: "admin.updateUserPlan",
          });
        } else {
          // planId is not a recognizable tier (custom/legacy price-id) —
          // clear the plan cache so the next read picks up planId via the
          // resolver chain in tenant-plan-policy.ts. We do not pass plan: to
          // the writer because we do not have a valid TenantPlanTier value.
          clearTenantPlanCache(tenantId);
        }
      } catch (syncErr) {
        logger.error(
          `[updateUserPlan] Failed to sync tenant plan for user ${userId}`,
          { userId, tenantId, error: (syncErr as Error).message },
        );
      }
    }

    await auditAdminAction(req, "super_admin_plan_updated", {
      tenantId,
      targetId: userId,
      reason: `plan:${planId}`,
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

    if (!userId) {
      return res.status(400).json({ message: "ID do usuário é obrigatório" });
    }

    if (!isSuperAdminClaim(req)) {
      return res.status(403).json({
        message:
          "Permissão negada. Apenas super admins podem alterar assinaturas.",
      });
    }

    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }
    const userData = (userSnap.data() || {}) as Record<string, unknown>;
    const tenantId = String(userData.tenantId || userData.companyId || "").trim();
    const tenantRef = tenantId ? db.collection("tenants").doc(tenantId) : null;
    const tenantSnap = tenantRef ? await tenantRef.get() : null;
    const tenantData = (tenantSnap?.data() || null) as Record<string, unknown> | null;

    const decision = buildManualSubscriptionUpdate(req.body || {}, {
      stripeManaged: isStripeManagedBilling(tenantData, userData),
    });
    if (!decision.ok) {
      return res
        .status(decision.status)
        .json({ message: decision.message, code: decision.code });
    }
    const safeUpdates = decision.updates;

    await userRef.update({
      ...safeUpdates,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Espelha no doc do tenant: a listagem do painel e o enforcement leem de la.
    // `update` so quando o doc existe; tenant legado sem doc nao ganha um parcial.
    if (tenantRef && tenantSnap?.exists) {
      await tenantRef.update({
        ...safeUpdates,
        billingSyncedAt: new Date().toISOString(),
      });
      clearTenantPlanCache(tenantId);
    }

    await auditAdminAction(req, "super_admin_subscription_updated", {
      tenantId,
      targetId: userId,
      reason: Object.keys(safeUpdates).join(","),
    });

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
    const isFreePlan = normalizedPlanId === "free";
    const planTier = normalizePlanTier(normalizedPlanId);
    if (!planTier) {
      return res.status(400).json({ message: "Plano inválido." });
    }
    const isManualSubscription = !isFreePlan;
    // Plano pago criado pelo painel e sempre contrato manual, e a data de fim e o
    // que o cron de assinaturas manuais vigia. Sem ela o tenant nasceria ativo
    // para sempre.
    const periodEndRaw = String(body.currentPeriodEnd || "").trim();
    const periodEnd = periodEndRaw ? new Date(periodEndRaw) : null;
    if (!isFreePlan && (!periodEnd || Number.isNaN(periodEnd.getTime()))) {
      return res.status(400).json({
        message: "Informe a data de vencimento do plano pago.",
      });
    }
    const subscriptionStatus = isFreePlan
      ? "free"
      : deriveManualStatusFromPeriodEnd(periodEnd as Date, new Date());
    // Conta free criada pelo painel tem que cair no mesmo gate de uma conta free
    // do cadastro (role "free"): com "admin" ela ganhava o ERP inteiro de graca.
    const userRole = isFreePlan ? "free" : "admin";

    const adminAuth = await auth.createUser({
      email: adminEmailValidation.normalizedEmail,
      password: adminPassword,
      displayName: adminName,
      emailVerified: false,
    });
    createdAuthUid = adminAuth.uid;

    await auth.setCustomUserClaims(adminAuth.uid, {
      role: isFreePlan ? "free" : "ADMIN",
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
        // whatsappEnabled is always false at creation time; it is recomputed via
        // tenantPlanAllowsWhatsApp() after the transaction to ensure eligibility
        // rules are enforced rather than accepting an arbitrary caller value.
        whatsappEnabled: false,
        isManualSubscription,
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
          whatsappEnabled: false,
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
        role: userRole,
        tenantId,
        companyId: tenantId,
        planId: normalizedPlanId,
        subscriptionStatus,
        currentPeriodEnd: isFreePlan ? null : periodEndRaw,
        isManualSubscription,
        onboarding: {
          version: "core-v1",
          status: "active",
          completedStepIds: [],
          currentStepId: "dashboard",
          startedAt: nowIso,
          updatedAt: nowIso,
        },
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

    // Plano e status do tenant pelo writer unico, o mesmo do Stripe: e de la que
    // o enforcement e o `forceSetTenantPlan` leem. Antes so o doc do usuario
    // recebia esses campos e o tenant caia no fallback pelo dono.
    await syncTenantPlanBillingSnapshot({
      tenantId,
      subscriptionStatus,
      plan: planTier,
      ...(periodEnd && !isFreePlan ? { currentPeriodEnd: periodEnd } : {}),
      source: "admin.createTenant",
    });

    await auditAdminAction(req, "super_admin_tenant_created", {
      tenantId,
      targetId: adminAuth.uid,
      reason: `plan:${planTier}`,
    });

    // Recompute whatsappEnabled after the transaction using the canonical
    // eligibility resolver. This replaces the caller-supplied value that was
    // written as `false` above so eligibility rules are always enforced.
    try {
      clearTenantPlanCache(tenantId);
      const allowsWhatsApp = await tenantPlanAllowsWhatsApp(tenantId);
      if (allowsWhatsApp) {
        await tenantRef.update({ whatsappEnabled: true });
        await db.collection("companies").doc(tenantId).update({ whatsappEnabled: true });
      }
    } catch (whatsappErr) {
      logger.error("[createTenant] Failed to recompute whatsappEnabled", {
        tenantId,
        error: (whatsappErr as Error).message,
      });
    }

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

function ownTenantIdOf(req: Request): string {
  return String(
    req.user?.impersonation?.originalTenantId || req.user?.tenantId || "",
  ).trim();
}

async function listTenantUserIds(tenantId: string): Promise<string[]> {
  const [byTenant, byCompany] = await Promise.all([
    db.collection("users").where("tenantId", "==", tenantId).select().limit(500).get(),
    db.collection("users").where("companyId", "==", tenantId).select().limit(500).get(),
  ]);
  return [...new Set([...byTenant.docs, ...byCompany.docs].map((d) => d.id))];
}

async function setTenantUsersDisabled(uids: string[], disabled: boolean): Promise<number> {
  let changed = 0;
  for (const uid of uids) {
    try {
      await auth.updateUser(uid, { disabled });
      if (disabled) await auth.revokeRefreshTokens(uid);
      changed += 1;
    } catch (err) {
      if ((err as { code?: string })?.code !== "auth/user-not-found") throw err;
    }
  }
  return changed;
}

/**
 * Cancela a assinatura Stripe da empresa e as dos add-ons. Sem isso, apagar a
 * empresa deixava o cliente sendo cobrado todo mes, e o webhook seguinte
 * recriava o doc do tenant.
 */
async function cancelTenantStripeSubscriptions(
  tenantId: string,
  tenantData: Record<string, unknown>,
): Promise<string[]> {
  const subscriptionIds = new Set<string>();
  const main = String(tenantData.stripeSubscriptionId || "").trim();
  if (main) subscriptionIds.add(main);
  const addonSnap = await db
    .collection("addons")
    .where("tenantId", "==", tenantId)
    .limit(50)
    .get();
  addonSnap.docs.forEach((d) => {
    const subId = String(d.get("stripeSubscriptionId") || "").trim();
    if (subId && String(d.get("status") || "") !== "cancelled") subscriptionIds.add(subId);
  });
  if (subscriptionIds.size === 0) return [];

  const stripe = getStripe();
  const cancelled: string[] = [];
  for (const subId of subscriptionIds) {
    try {
      await stripe.subscriptions.cancel(subId);
      cancelled.push(subId);
    } catch (err) {
      const e = err as { code?: string; statusCode?: number };
      // Ja cancelada ou inexistente: o objetivo (parar de cobrar) ja esta cumprido.
      if (e?.code === "resource_missing" || e?.statusCode === 404) continue;
      throw err;
    }
  }
  return cancelled;
}

/**
 * "Desativar" empresa: primeiro passo, reversivel. Para a cobranca no Stripe,
 * bloqueia o login de todos os usuarios (Auth desativado + tokens revogados) e
 * marca o tenant. Nenhum dado e apagado; isso so acontece em "Excluir
 * definitivamente", que exige a empresa desativada antes.
 */
export const deactivateTenant = async (req: Request, res: Response) => {
  try {
    if (!isSuperAdminClaim(req)) {
      return res.status(403).json({ message: "Permissão negada." });
    }
    const tenantId = String(req.params.tenantId || "").trim();
    if (!tenantId) return res.status(400).json({ message: "tenantId é obrigatório." });
    if (tenantId === ownTenantIdOf(req)) {
      return res.status(400).json({ message: "Você não pode desativar a própria empresa." });
    }

    const tenantRef = db.collection("tenants").doc(tenantId);
    const tenantSnap = await tenantRef.get();
    if (!tenantSnap.exists) return res.status(404).json({ message: "Empresa não encontrada." });
    const tenantData = (tenantSnap.data() || {}) as Record<string, unknown>;
    if (tenantData.accountStatus === "purged" || tenantData.accountStatus === "purging") {
      return res.status(409).json({ message: "Esta empresa já está sendo excluída." });
    }

    const cancelledSubscriptions = await cancelTenantStripeSubscriptions(tenantId, tenantData);
    const userIds = await listTenantUserIds(tenantId);
    const disabledUsers = await setTenantUsersDisabled(userIds, true);

    const nowIso = new Date().toISOString();
    await tenantRef.update({
      accountStatus: "deactivated",
      deactivatedAt: nowIso,
      deactivatedBy: req.user?.uid || null,
      // Sai do radar do cron de assinatura manual: nao ha mais contrato a vigiar.
      isManualSubscription: false,
      updatedAt: nowIso,
    });
    clearTenantPlanCache(tenantId);

    await auditAdminAction(req, "super_admin_tenant_deactivated", {
      tenantId,
      reason: `users:${disabledUsers};stripe:${cancelledSubscriptions.length}`,
    });

    return res.json({
      success: true,
      disabledUsers,
      cancelledSubscriptions: cancelledSubscriptions.length,
      message: "Empresa desativada. O login foi bloqueado e a cobrança cancelada.",
    });
  } catch (error: unknown) {
    logger.error("[deactivateTenant] failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ message: "Erro ao desativar empresa." });
  }
};

/**
 * Desfaz a desativacao: libera o login de novo. A assinatura Stripe cancelada
 * NAO volta sozinha; o cliente assina de novo ou o plano e ajustado no painel.
 */
export const reactivateTenant = async (req: Request, res: Response) => {
  try {
    if (!isSuperAdminClaim(req)) {
      return res.status(403).json({ message: "Permissão negada." });
    }
    const tenantId = String(req.params.tenantId || "").trim();
    if (!tenantId) return res.status(404).json({ message: "Empresa não encontrada." });
    const tenantRef = db.collection("tenants").doc(tenantId);
    const tenantSnap = await tenantRef.get();
    if (!tenantSnap.exists) {
      return res.status(404).json({ message: "Empresa não encontrada." });
    }
    if (tenantSnap.get("accountStatus") !== "deactivated") {
      return res.status(409).json({ message: "Só é possível reativar uma empresa desativada." });
    }

    const enabledUsers = await setTenantUsersDisabled(await listTenantUserIds(tenantId), false);
    const nowIso = new Date().toISOString();
    await tenantRef.update({
      accountStatus: "active",
      reactivatedAt: nowIso,
      reactivatedBy: req.user?.uid || null,
      updatedAt: nowIso,
    });
    clearTenantPlanCache(tenantId);

    await auditAdminAction(req, "super_admin_tenant_reactivated", {
      tenantId,
      reason: `users:${enabledUsers}`,
    });

    return res.json({ success: true, enabledUsers, message: "Empresa reativada." });
  } catch (error: unknown) {
    logger.error("[reactivateTenant] failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ message: "Erro ao reativar empresa." });
  }
};

/**
 * "Excluir definitivamente": so para empresa ja desativada, e exige o nome da
 * empresa digitado. Cria o job; o trigger `onTenantPurgeJob` apaga em etapas.
 * Notas fiscais e o arquivo fiscal ficam (guarda legal de 5 anos).
 */
export const purgeTenant = async (req: Request, res: Response) => {
  try {
    if (!isSuperAdminClaim(req)) {
      return res.status(403).json({ message: "Permissão negada." });
    }
    const tenantId = String(req.params.tenantId || "").trim();
    if (!tenantId) return res.status(400).json({ message: "tenantId é obrigatório." });
    if (tenantId === ownTenantIdOf(req)) {
      return res.status(400).json({ message: "Você não pode excluir a própria empresa." });
    }

    const tenantRef = db.collection("tenants").doc(tenantId);
    const tenantSnap = await tenantRef.get();
    if (!tenantSnap.exists) return res.status(404).json({ message: "Empresa não encontrada." });
    if (tenantSnap.get("accountStatus") !== "deactivated") {
      return res.status(409).json({
        message: "Desative a empresa antes de excluir definitivamente.",
      });
    }

    const expected = String(tenantSnap.get("name") || "").trim().toLowerCase();
    const typed = String(req.body?.confirmName || "").trim().toLowerCase();
    if (!expected || typed !== expected) {
      return res.status(400).json({ message: "O nome digitado não confere com o da empresa." });
    }

    const nowIso = new Date().toISOString();
    await tenantRef.update({ accountStatus: "purging", updatedAt: nowIso });
    await db.collection(TENANT_PURGE_JOBS_COLLECTION).doc(tenantId).set({
      tenantId,
      tenantName: tenantSnap.get("name") || null,
      status: "pending",
      stageIndex: 0,
      totalStages: buildPurgeStages().length,
      requestedBy: req.user?.uid || null,
      createdAt: nowIso,
    });

    await auditAdminAction(req, "super_admin_tenant_purge_requested", { tenantId });

    return res.status(202).json({
      success: true,
      message: "Exclusão iniciada. Os dados são apagados em segundo plano.",
    });
  } catch (error: unknown) {
    logger.error("[purgeTenant] failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ message: "Erro ao iniciar a exclusão." });
  }
};

/**
 * Records the start of a super admin "view as tenant" session. Called by the
 * admin panel when a super admin opens another company's dashboard, giving the
 * audit trail an explicit entry point in addition to per-write events.
 */
export const startImpersonation = async (req: Request, res: Response) => {
  try {
    if (!isSuperAdminClaim(req)) {
      return res.status(403).json({ message: "Permissão negada." });
    }

    const tenantId = String(req.body?.tenantId || "").trim();
    if (!tenantId) {
      return res.status(400).json({ message: "tenantId é obrigatório." });
    }

    try {
      await assertTenantExists(tenantId);
    } catch {
      return res
        .status(400)
        .json({ message: "Empresa inválida ou inexistente." });
    }

    const uid = req.user!.uid;
    const route = req.originalUrl || req.path;

    await writeSecurityAuditEvent({
      eventType: "super_admin_impersonation_started",
      uid,
      tenantId,
      route,
      requestId: req.requestId,
      source: "admin_controller",
    });
    await incrementSecurityCounter("super_admin_impersonation_started", {
      uid,
      tenantId,
      route,
      requestId: req.requestId,
    });

    return res.json({ success: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ message });
  }
};

/**
 * Fim de uma sessao "Acessar Painel". Sem ele a auditoria so tinha a entrada:
 * nao dava para saber quanto tempo o superadmin ficou dentro da empresa nem se
 * as escritas seguintes ainda eram daquela sessao.
 *
 * Melhor esforco por natureza (fechar a aba nao chama nada), por isso aceita
 * `reason` para distinguir saida pelo botao de saida implicita.
 */
export const stopImpersonation = async (req: Request, res: Response) => {
  try {
    if (!isSuperAdminClaim(req)) {
      return res.status(403).json({ message: "Permissão negada." });
    }
    const tenantId = String(req.body?.tenantId || "").trim();
    if (!tenantId) {
      return res.status(400).json({ message: "tenantId é obrigatório." });
    }
    const reason = String(req.body?.reason || "exit_button").trim().slice(0, 40);

    await auditAdminAction(req, "super_admin_impersonation_stopped", {
      tenantId,
      reason,
    });

    return res.json({ success: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ message });
  }
};

/**
 * Returns recent security audit events for the super admin panel. The
 * `security_audit_events` collection is written via the Admin SDK and is denied
 * to the client SDK by Firestore rules, so this is the only read path. The
 * tenant filter runs at the database level (composite index tenantId+createdAt);
 * uid/eventType remain in-memory over the tenant-scoped window. See
 * `fetchAuditEvents` for the index-build fallback.
 */
/**
 * Quem agiu, resolvido a partir do `uid` do evento.
 *
 * Sem isso a tela de auditoria nao distingue uma acao do super admin dentro do
 * painel de uma empresa de uma acao do proprio usuario dela: as duas ficam com
 * o mesmo tenantId. O papel vem do doc do usuario, entao "super admin" e um
 * fato, nao um palpite pelo tipo do evento.
 */
async function withActors(
  events: Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> {
  const uids = [
    ...new Set(
      events
        .map((e) => String(e.uid || "").trim())
        .filter(Boolean),
    ),
  ];
  if (uids.length === 0) return events;

  const actors = new Map<string, Record<string, unknown>>();
  try {
    const snaps = await db.getAll(
      ...uids.map((id) => db.collection("users").doc(id)),
    );
    for (const snap of snaps) {
      if (!snap.exists) continue;
      const role = String(snap.get("role") || "").trim();
      actors.set(snap.id, {
        uid: snap.id,
        name: String(snap.get("name") || snap.get("displayName") || ""),
        email: String(snap.get("email") || ""),
        role,
        isSuperAdmin: role.toLowerCase() === "superadmin",
      });
    }
  } catch (err) {
    // Sem o nome de quem agiu a auditoria ainda serve; o uid continua no evento.
    logger.warn("[getAuditEvents] actor lookup failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return events;
  }

  return events.map((event) => {
    const actor = actors.get(String(event.uid || ""));
    return actor ? { ...event, actor } : event;
  });
}

export const getAuditEvents = async (req: Request, res: Response) => {
  try {
    if (!isSuperAdminClaim(req)) {
      return res.status(403).json({ message: "Permissão negada." });
    }

    const tenantId = String(req.query.tenantId || "").trim();
    const uid = String(req.query.uid || "").trim();
    const eventType = String(req.query.eventType || "").trim();

    const requestedLimit = Number(req.query.limit);
    const limit =
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(Math.floor(requestedLimit), 200)
        : 50;

    const events = await fetchAuditEvents(
      db.collection(resolveSecurityAuditCollection()),
      { tenantId, uid, eventType, limit },
    );

    return res.json({ events: await withActors(events) });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ message });
  }
};


type CloneImageStats = {
  copied: number;
  reused: number;
  failed: number;
};

function extractStoragePathFromUrl(urlOrPath: string): string | null {
  if (urlOrPath.startsWith("tenants/")) return urlOrPath;

  if (
    urlOrPath.includes("firebasestorage.googleapis.com") ||
    urlOrPath.includes("firebasestorage.app")
  ) {
    const decodedUrl = decodeURIComponent(urlOrPath);
    const match = decodedUrl.match(/\/o\/(.+?)\?/);
    return match?.[1] || null;
  }

  if (urlOrPath.includes("storage.googleapis.com")) {
    const parts = urlOrPath.split("/");
    const bucketIndex = parts.findIndex(
      (part) =>
        part.includes(".appspot.com") || part.includes("firebasestorage.app"),
    );
    if (bucketIndex >= 0) {
      return parts.slice(bucketIndex + 1).join("/");
    }
  }

  return null;
}

function buildFirebaseDownloadUrl(
  bucketName: string,
  filePath: string,
  token: string,
): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;
}

async function cloneImageUrlsForTenant(options: {
  urls: string[];
  sourceTenantId: string;
  targetTenantId: string;
  folder: "products" | "services";
  targetEntityId: string;
}): Promise<{ urls: string[]; stats: CloneImageStats }> {
  const bucket = getStorage().bucket();
  const mappedUrls: string[] = [];
  const stats: CloneImageStats = { copied: 0, reused: 0, failed: 0 };
  const memoBySourcePath = new Map<string, string>();

  for (let index = 0; index < options.urls.length; index++) {
    const rawUrl = options.urls[index];
    const imageUrl = String(rawUrl || "").trim();

    if (!imageUrl || imageUrl.startsWith("data:")) {
      if (imageUrl) mappedUrls.push(imageUrl);
      stats.reused += 1;
      continue;
    }

    const sourcePath = extractStoragePathFromUrl(imageUrl);
    if (!sourcePath) {
      mappedUrls.push(imageUrl);
      stats.reused += 1;
      continue;
    }

    const expectedPrefix = `tenants/${options.sourceTenantId}/${options.folder}/`;
    if (!sourcePath.startsWith(expectedPrefix)) {
      mappedUrls.push(imageUrl);
      stats.reused += 1;
      continue;
    }

    const memoUrl = memoBySourcePath.get(sourcePath);
    if (memoUrl) {
      mappedUrls.push(memoUrl);
      stats.reused += 1;
      continue;
    }

    const sourceFile = bucket.file(sourcePath);
    try {
      const [exists] = await sourceFile.exists();
      if (!exists) {
        mappedUrls.push(imageUrl);
        stats.failed += 1;
        continue;
      }

      const fileName = sourcePath.split("/").pop() || `${Date.now()}-${index}.jpg`;
      const destinationPath = `tenants/${options.targetTenantId}/${options.folder}/${options.targetEntityId}/${fileName}`;
      const destinationFile = bucket.file(destinationPath);

      await sourceFile.copy(destinationFile);

      const token = randomUUID();
      await destinationFile.setMetadata({
        metadata: {
          firebaseStorageDownloadTokens: token,
        },
      });

      const destinationUrl = buildFirebaseDownloadUrl(
        bucket.name,
        destinationPath,
        token,
      );

      memoBySourcePath.set(sourcePath, destinationUrl);
      mappedUrls.push(destinationUrl);
      stats.copied += 1;
    } catch (error) {
      console.error("[copyTenantData] image clone failed", {
        sourcePath,
        targetEntityId: options.targetEntityId,
        folder: options.folder,
        message: error instanceof Error ? error.message : String(error),
      });

      mappedUrls.push(imageUrl);
      stats.failed += 1;
    }
  }

  return { urls: mappedUrls, stats };
}

export const copyTenantData = async (req: Request, res: Response) => {
  try {
    if (!isSuperAdminClaim(req)) {
      return res.status(403).json({
        message: "Permissão negada. Apenas super admins podem copiar dados de tenants.",
      });
    }

    const sourceTenantId = String(req.body?.sourceTenantId || "").trim();
    const targetTenantId = String(req.body?.targetTenantId || "").trim();
    const replace = req.body?.replace === true;

    if (!sourceTenantId || !targetTenantId) {
      return res.status(400).json({ message: "sourceTenantId e targetTenantId são obrigatórios." });
    }
    // Com os dois ids iguais, o "limpar destino" antigo apagava o catalogo da
    // propria origem e depois nao tinha nada para copiar.
    if (sourceTenantId === targetTenantId) {
      return res.status(400).json({ message: "Origem e destino precisam ser empresas diferentes." });
    }
    try {
      await assertTenantExists(sourceTenantId);
      await assertTenantExists(targetTenantId);
    } catch {
      return res.status(400).json({ message: "Empresa de origem ou destino inexistente." });
    }

    const allCollections = ["products", "services", "ambientes", "sistemas"];
    const now = Timestamp.now();
    const nowTimestampStr = now.toDate().toISOString();

    // Substituir apaga o catalogo ANTIGO do destino, e so depois de a copia
    // terminar: se ela falhar no meio, o destino fica com o que tinha mais uma
    // copia parcial, nunca vazio. Os ids sao lidos antes para nao apagar o que
    // acabou de ser copiado.
    const previousTargetRefs: FirebaseFirestore.DocumentReference[] = [];
    if (replace) {
      for (const col of allCollections) {
        const existing = await db
          .collection(col)
          .where("tenantId", "==", targetTenantId)
          .select()
          .get();
        existing.docs.forEach((d) => previousTargetRefs.push(d.ref));
      }
    }

    const baseCollections = ["products", "services", "ambientes"];

    let totalCopied = 0;
    const dictionary: Record<string, string> = {}; // Mapping of oldId -> newId
    const imageCloneStats: CloneImageStats = { copied: 0, reused: 0, failed: 0 };

    // 1. Copy root collections first and map their new IDs
    for (const collectionName of baseCollections) {
      const sourceQuery = db.collection(collectionName).where("tenantId", "==", sourceTenantId);
      const snapshot = await sourceQuery.get();

      if (snapshot.empty) continue;

      const batches: FirebaseFirestore.WriteBatch[] = [];
      let currentBatch = db.batch();
      let operationCount = 0;

      for (const docSnap of snapshot.docs) {
        if (operationCount === 500) {
          batches.push(currentBatch);
          currentBatch = db.batch();
          operationCount = 0;
        }

        const data = docSnap.data();
        const newRef = db.collection(collectionName).doc();
        dictionary[docSnap.id] = newRef.id;

        const newData: any = {
          ...data,
          tenantId: targetTenantId,
          companyId: targetTenantId, // Legacy fallback
          createdAt: data.createdAt || nowTimestampStr,
          updatedAt: nowTimestampStr,
        };

        if (typeof data.id === 'string') newData.id = newRef.id;

        if (collectionName === "products" || collectionName === "services") {
          const sourceImages = Array.isArray(data.images)
            ? data.images.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
            : [];

          const fallbackImage =
            typeof data.image === "string" && data.image.trim().length > 0
              ? data.image
              : "";

          const cloneInputImages = sourceImages.length > 0
            ? sourceImages
            : fallbackImage
              ? [fallbackImage]
              : [];

          if (cloneInputImages.length > 0) {
            const cloneResult = await cloneImageUrlsForTenant({
              urls: cloneInputImages,
              sourceTenantId,
              targetTenantId,
              folder: collectionName,
              targetEntityId: newRef.id,
            });

            newData.images = cloneResult.urls;
            if (typeof data.image === "string") {
              newData.image = cloneResult.urls[0] || data.image;
            }

            imageCloneStats.copied += cloneResult.stats.copied;
            imageCloneStats.reused += cloneResult.stats.reused;
            imageCloneStats.failed += cloneResult.stats.failed;
          }
        }

        currentBatch.set(newRef, newData);
        operationCount++;
        totalCopied++;
      }

      if (operationCount > 0) batches.push(currentBatch);
      for (const batch of batches) await batch.commit();
    }

    // 2. Now clone Sistemas translating the inner references
    const sistemasQuery = db.collection("sistemas").where("tenantId", "==", sourceTenantId);
    const sistemasSnapshot = await sistemasQuery.get();

    if (!sistemasSnapshot.empty) {
      const batches: FirebaseFirestore.WriteBatch[] = [];
      let currentBatch = db.batch();
      let operationCount = 0;

      sistemasSnapshot.docs.forEach((docSnap) => {
        if (operationCount === 500) {
          batches.push(currentBatch);
          currentBatch = db.batch();
          operationCount = 0;
        }

        const data = docSnap.data();
        const newRef = db.collection("sistemas").doc();
        // Option to save mapping for Sistema itself just in case future features need it
        dictionary[docSnap.id] = newRef.id;

        const newData: any = {
          ...data,
          tenantId: targetTenantId,
          companyId: targetTenantId,
          createdAt: data.createdAt || nowTimestampStr,
          updatedAt: nowTimestampStr,
        };

        if (typeof data.id === 'string') newData.id = newRef.id;

        // Map Ambientes inside this Sistema
        if (Array.isArray(newData.ambientes)) {
          newData.ambientes = newData.ambientes.map((amb: any) => {
            const newAmbienteId = dictionary[amb.ambienteId] || amb.ambienteId;

            // Map Products inside this Ambiente
            const newProducts = Array.isArray(amb.products) ? amb.products.map((prod: any) => {
              return {
                ...prod,
                productId: dictionary[prod.productId] || prod.productId,
              };
            }) : [];

            return {
              ...amb,
              ambienteId: newAmbienteId,
              products: newProducts
            };
          });
        }

        // Map availableAmbienteIds (used by frontend to filter ambiente dropdown)
        if (Array.isArray(newData.availableAmbienteIds)) {
          newData.availableAmbienteIds = newData.availableAmbienteIds.map(
            (oldId: string) => dictionary[oldId] || oldId
          );
        }

        // Map ambienteIds (legacy field, kept in sync)
        if (Array.isArray(newData.ambienteIds)) {
          newData.ambienteIds = newData.ambienteIds.map(
            (oldId: string) => dictionary[oldId] || oldId
          );
        }

        // Map defaultProducts (legacy system-level products)
        if (Array.isArray(newData.defaultProducts)) {
          newData.defaultProducts = newData.defaultProducts.map((prod: any) => ({
            ...prod,
            productId: dictionary[prod.productId] || prod.productId,
          }));
        }

        currentBatch.set(newRef, newData);
        operationCount++;
        totalCopied++;
      });

      if (operationCount > 0) batches.push(currentBatch);
      for (const batch of batches) await batch.commit();
    }

    for (let i = 0; i < previousTargetRefs.length; i += 500) {
      const batch = db.batch();
      previousTargetRefs.slice(i, i + 500).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }

    await auditAdminAction(req, "super_admin_copy_data", {
      tenantId: targetTenantId,
      targetId: sourceTenantId,
      reason: `copied:${totalCopied};replaced:${previousTargetRefs.length}`,
    });

    return res.json({
      success: true,
      message: replace
        ? `Cópia concluída. ${totalCopied} registros copiados e ${previousTargetRefs.length} antigos removidos.`
        : `Cópia concluída. ${totalCopied} registros copiados com sucesso.`,
      totalCopied,
      removed: previousTargetRefs.length,
      imageCloneStats,
    });
  } catch (error: unknown) {
    console.error("[copyTenantData] error:", error);
    const message = error instanceof Error ? error.message : "Erro ao copiar dados do tenant.";
    return res.status(500).json({ message });
  }
};

export const recomputeTenantFeatures = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!isSuperAdminClaim(req)) {
      return res.status(403).json({
        message: "Permissão negada. Apenas super admins podem recomputar features de tenant.",
      });
    }

    const tenantId = String(req.params.tenantId || "").trim();
    if (!tenantId) {
      return res.status(400).json({ message: "tenantId é obrigatório." });
    }

    const tenantRef = db.collection("tenants").doc(tenantId);
    const tenantSnap = await tenantRef.get();
    if (!tenantSnap.exists) {
      return res.status(404).json({ message: "Tenant não encontrado." });
    }

    clearTenantPlanCache(tenantId);
    const profile = await getTenantPlanProfile(tenantId);
    const allowsWhatsApp = await tenantPlanAllowsWhatsApp(tenantId);

    // EXEMPT: recomputeTenantFeatures re-asserts plan from cache with no
    // subscription-state mutation. profile.tier is read from getTenantPlanProfile
    // (which reads the existing tenant plan, not Stripe) — routing through
    // syncTenantPlanBillingSnapshot would require a synthetic subscriptionStatus
    // and produce no behavior change. Remaining fields (whatsappEnabled,
    // featuresRecomputedAt) are non-billing-state per Phase 19 schema —
    // whatsappEnabled is the Pitfall 2 carve-out, featuresRecomputedAt is a
    // recompute timestamp. plan field is intentionally NOT written here so the
    // single writer remains the only path that mutates billing-state plan.
    await tenantRef.update({
      whatsappEnabled: allowsWhatsApp,
      featuresRecomputedAt: new Date().toISOString(),
    });

    return res.json({
      tenantId,
      tier: profile.tier,
      source: profile.source,
      whatsappEnabled: allowsWhatsApp,
    });
  } catch (err) {
    console.error("[recomputeTenantFeatures] failed", err);
    return res.status(500).json({
      message: "Erro ao recomputar features do tenant.",
    });
  }
};

export const forceSetTenantPlan = async (req: Request, res: Response) => {
  try {
    if (!isSuperAdminClaim(req)) {
      return res.status(403).json({
        message: "Permissão negada. Apenas super admins podem forçar o plano.",
      });
    }

    const tenantId = String(req.params.tenantId || "").trim();
    const tier = normalizePlanTier(req.body?.tier);

    if (!tenantId) {
      return res.status(400).json({ message: "tenantId é obrigatório." });
    }
    if (!tier) {
      return res.status(400).json({
        message: "tier inválido. Use: free, starter, pro ou enterprise.",
      });
    }

    const tenantRef = db.collection("tenants").doc(tenantId);
    const tenantSnap = await tenantRef.get();
    if (!tenantSnap.exists) {
      return res.status(404).json({ message: "Tenant não encontrado." });
    }

    const tenantData = tenantSnap.data() as Record<string, unknown>;
    if (!tenantData.isManualSubscription) {
      return res.status(409).json({
        code: "NOT_MANUAL_SUBSCRIPTION",
        message:
          "Forçar plano só é permitido para assinaturas manuais. Tenants gerenciados pelo Stripe devem ser alterados via Stripe.",
      });
    }

    // Read existing subscriptionStatus from the doc we already loaded above.
    // forceSetTenantPlan is a manual-subscription override (guard above ensures
    // tenantData.isManualSubscription === true), so subscription is "active" by
    // virtue of the operator invoking this endpoint. Use existing status when
    // present, fall back to "active" when the field is missing or empty.
    const existingSubscriptionStatus =
      typeof tenantData.subscriptionStatus === "string" &&
      tenantData.subscriptionStatus.trim()
        ? (tenantData.subscriptionStatus as string)
        : "active";

    // Phase 19 single-writer: route plan + scheduled fields through the single
    // writer so subscription.* stays in sync. clearScheduled: true clears
    // scheduledPlan/At/Reason inside the same transaction. The writer handles
    // clearTenantPlanCache + whatsappEnabled second-write internally.
    await syncTenantPlanBillingSnapshot({
      tenantId,
      subscriptionStatus: existingSubscriptionStatus,
      plan: tier,
      clearScheduled: true,
      source: "admin.forceSetTenantPlan",
    });

    // Enterprise tier always allows WhatsApp; the single writer's internal
    // whatsappEnabled re-evaluation already handled allowsWhatsApp for non-
    // enterprise tiers. The enterprise-true override is preserved here for
    // parity with previous behavior. featuresRecomputedAt is a non-billing-
    // state recompute marker in both branches.
    if (tier === "enterprise") {
      // EXEMPT: whatsappEnabled enterprise override + featuresRecomputedAt are non-billing-state fields
      await tenantRef.update({
        whatsappEnabled: true,
        featuresRecomputedAt: new Date().toISOString(),
      });
    } else {
      // EXEMPT: featuresRecomputedAt is a non-billing-state recompute marker
      await tenantRef.update({
        featuresRecomputedAt: new Date().toISOString(),
      });
    }

    await auditAdminAction(req, "super_admin_plan_forced", {
      tenantId,
      reason: `plan:${tier}`,
    });

    logger.info("[forceSetTenantPlan] plan forced", {
      tenantId,
      tier,
      uid: req.user?.uid,
    });

    return res.json({
      tenantId,
      tier,
      whatsappEnabled: tier === "enterprise" ? true : await tenantPlanAllowsWhatsApp(tenantId),
    });
  } catch (err) {
    logger.error("[forceSetTenantPlan] failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return res.status(500).json({ message: "Erro ao forçar plano do tenant." });
  }
};

type MigratePricesResult = {
  tenantId: string;
  status: "migrated" | "skipped" | "failed";
  reason?: string;
  fromPriceId?: string;
  toPriceId?: string;
};

export const migrateTenantPrices = async (
  req: Request,
  res: Response,
): Promise<void> => {
  if (!isSuperAdminClaim(req)) {
    res.status(403).json({ error: "FORBIDDEN" });
    return;
  }

  const { tenantIds, prorationBehavior = "none" } = req.body as {
    tenantIds?: string[];
    prorationBehavior?: "none" | "create_prorations";
  };

  if (!Array.isArray(tenantIds) || tenantIds.length === 0) {
    res
      .status(400)
      .json({ error: "tenantIds is required and must be a non-empty array" });
    return;
  }
  if (tenantIds.length > 50) {
    res.status(400).json({ error: "Maximum 50 tenants per request" });
    return;
  }

  const stripe = getStripe();
  const WHATSAPP_OVERAGE_PRICE_ID = "price_1T20T7GrkF9UfsqcEtdBX9fY";

  const results: MigratePricesResult[] = [];

  for (const tenantId of tenantIds) {
    try {
      const tenantRef = db.collection("tenants").doc(tenantId);
      const tenantSnap = await tenantRef.get();

      if (!tenantSnap.exists) {
        results.push({ tenantId, status: "skipped", reason: "tenant not found" });
        continue;
      }

      const tenantData = tenantSnap.data() as Record<string, unknown>;
      const drift = detectPriceDrift({
        stripePriceId: tenantData.stripePriceId as string | undefined,
        priceId: tenantData.priceId as string | undefined,
        billingInterval: tenantData.billingInterval as string | undefined,
        isManualSubscription: Boolean(tenantData.isManualSubscription),
        stripeSubscriptionId: tenantData.stripeSubscriptionId as
          | string
          | undefined,
      });

      if (!drift.hasDrift) {
        results.push({ tenantId, status: "skipped", reason: "no drift detected" });
        continue;
      }

      const stripeSubscriptionId = String(
        tenantData.stripeSubscriptionId ?? "",
      ).trim();
      const subscription = await stripe.subscriptions.retrieve(
        stripeSubscriptionId,
        { expand: ["items"] },
      );

      if (subscription.cancel_at_period_end) {
        results.push({
          tenantId,
          status: "skipped",
          reason: "subscription canceling at period end",
        });
        continue;
      }

      const planItem = subscription.items.data.find(
        (item) => item.price.id !== WHATSAPP_OVERAGE_PRICE_ID,
      );

      if (!planItem) {
        results.push({
          tenantId,
          status: "failed",
          reason: "no plan item found in subscription",
        });
        continue;
      }

      await stripe.subscriptions.update(stripeSubscriptionId, {
        items: [{ id: planItem.id, price: drift.expectedPriceId! }],
        proration_behavior: prorationBehavior,
      });

      await tenantRef.update({
        priceChangeNotifiedFor: null,
        priceChangeNotifiedAt: null,
      });

      results.push({
        tenantId,
        status: "migrated",
        fromPriceId: drift.currentPriceId ?? undefined,
        toPriceId: drift.expectedPriceId ?? undefined,
      });

      logger.info("[migrateTenantPrices] migrated", {
        tenantId,
        fromPriceId: drift.currentPriceId,
        toPriceId: drift.expectedPriceId,
        prorationBehavior,
        requestedBy: req.user?.uid,
      });
    } catch (err) {
      logger.error("[migrateTenantPrices] error", {
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
      results.push({
        tenantId,
        status: "failed",
        reason: err instanceof Error ? err.message : "unknown error",
      });
    }
  }

  const migrated = results.filter((r) => r.status === "migrated").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const failed = results.filter((r) => r.status === "failed").length;

  await auditAdminAction(req, "super_admin_prices_migrated", {
    reason: `migrated:${migrated};skipped:${skipped};failed:${failed}`,
  });

  res.json({ migrated, skipped, failed, results });
};
