import { Request, Response } from "express";
import { db, auth } from "../../init";
import { Timestamp } from "firebase-admin/firestore";
import {
  upsertPhoneNumberIndexTx,
  normalizePhoneNumber,
} from "./admin.controller";
import { validateBrazilMobilePhone } from "../../lib/contact-validation";

type OnboardingStatus = "active" | "completed" | "skipped";

function normalizeIsoString(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string" && value.trim()) return value.trim();
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return undefined;
}

function normalizeOnboardingPayload(
  rawValue: unknown,
  currentValue: unknown,
): Record<string, unknown> {
  const raw =
    rawValue && typeof rawValue === "object"
      ? (rawValue as Record<string, unknown>)
      : {};
  const current =
    currentValue && typeof currentValue === "object"
      ? (currentValue as Record<string, unknown>)
      : {};

  const rawStatus = String(raw.status || current.status || "active")
    .trim()
    .toLowerCase();
  const status: OnboardingStatus =
    rawStatus === "completed" || rawStatus === "skipped"
      ? rawStatus
      : "active";

  const completedStepIdsSource = Array.isArray(raw.completedStepIds)
    ? raw.completedStepIds
    : Array.isArray(current.completedStepIds)
      ? current.completedStepIds
      : [];

  const completedStepIds = Array.from(
    new Set(
      completedStepIdsSource
        .map((stepId) => String(stepId || "").trim())
        .filter(Boolean),
    ),
  );

  const currentStepId = String(raw.currentStepId || current.currentStepId || "")
    .trim();
  const startedAt =
    normalizeIsoString(raw.startedAt) ||
    normalizeIsoString(current.startedAt) ||
    new Date().toISOString();
  const updatedAt = new Date().toISOString();
  const completedAt =
    status === "completed"
      ? normalizeIsoString(raw.completedAt) ||
        normalizeIsoString(current.completedAt) ||
        updatedAt
      : null;
  const skippedAt =
    status === "skipped"
      ? normalizeIsoString(raw.skippedAt) ||
        normalizeIsoString(current.skippedAt) ||
        updatedAt
      : null;

  return {
    version: String(raw.version || current.version || "core-v1").trim(),
    status,
    completedStepIds,
    currentStepId: currentStepId || null,
    startedAt,
    updatedAt,
    completedAt,
    skippedAt,
  };
}

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { name, phoneNumber, onboarding } = req.body;

    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const userData = userSnap.data();

    // Ensure we run in transaction if we are updating the phone number index
    const now = Timestamp.now();
    const updateData: Record<string, any> = { updatedAt: now };

    if (name !== undefined) updateData.name = name;

    // Auth display name update
    const authUpdates: { displayName?: string } = {};
    if (name && name !== userData?.name) {
      authUpdates.displayName = name;
    }

    if (Object.keys(authUpdates).length > 0) {
      try {
        await auth.updateUser(userId, authUpdates);
      } catch (err: unknown) {
        console.error("Error updating auth user profile", err);
        // Continue, not fatal usually
      }
    }

    if (onboarding !== undefined) {
      updateData.onboarding = normalizeOnboardingPayload(
        onboarding,
        userData?.onboarding,
      );
    }

    if (phoneNumber !== undefined) {
      const phoneValidation = validateBrazilMobilePhone(phoneNumber);
      if (!phoneValidation.valid) {
        return res.status(400).json({
          message: phoneValidation.reason || "Telefone inválido.",
        });
      }

      // Normalize inside the tx function
      updateData.phoneNumber = normalizePhoneNumber(phoneNumber) || null;

      try {
        await db.runTransaction(async (transaction) => {
          await upsertPhoneNumberIndexTx(transaction, {
            userId,
            tenantId: userData?.tenantId || userData?.companyId || "", // Needed for whatsapp limits mapping
            newPhoneNumber: phoneNumber,
            previousPhoneNumber: userData?.phoneNumber,
            now,
          });

          transaction.update(userRef, updateData);
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "PHONE_ALREADY_LINKED") {
          return res.status(409).json({
            message: "Este telefone já está vinculado a outro usuário.",
          });
        }
        throw err;
      }
    } else {
      // Just update user doc if no phone change requested
      await userRef.update(updateData);
    }

    return res.json({
      success: true,
      message: "Perfil atualizado com sucesso.",
    });
  } catch (error: unknown) {
    console.error("updateProfile Error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Erro interno ao atualizar perfil.";
    return res.status(500).json({ message });
  }
};
