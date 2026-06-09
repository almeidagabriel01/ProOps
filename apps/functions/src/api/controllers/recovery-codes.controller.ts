import { Request, Response } from "express";
import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "../../init";
import { logger } from "../../lib/logger";
import { writeSecurityAuditEvent } from "../../lib/security-observability";
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  verifyRecoveryCode,
  type HashedRecoveryCode,
} from "../../lib/mfa-recovery-codes";

const RECOVERY_CODES_COLLECTION = "mfaRecoveryCodes";
const RECOVERY_CODE_COUNT = 10;

const verifySchema = z.object({
  code: z.string().min(1),
});

interface StoredRecoveryCode {
  hash: string;
  usedAt: Timestamp | null;
}

interface RecoveryCodesDoc {
  uid: string;
  codes: StoredRecoveryCode[];
  generatedAt: Timestamp;
}

/** Count codes that have not yet been consumed. */
function countRemaining(codes: StoredRecoveryCode[]): number {
  return codes.filter((c) => c.usedAt === null || c.usedAt === undefined).length;
}

export const generateRecoveryCodesHandler = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const uid = req.user!.uid;
    const tenantId = req.user!.tenantId;

    const codes = generateRecoveryCodes(RECOVERY_CODE_COUNT);
    const stored: StoredRecoveryCode[] = codes.map((code) => ({
      hash: hashRecoveryCode(code),
      usedAt: null,
    }));

    await db
      .collection(RECOVERY_CODES_COLLECTION)
      .doc(uid)
      .set({
        uid,
        codes: stored,
        generatedAt: Timestamp.now(),
      } satisfies RecoveryCodesDoc);

    void writeSecurityAuditEvent({
      eventType: "recovery_codes_generated",
      uid,
      tenantId,
      route: req.path,
      source: "mfa_recovery_codes",
    });

    logger.info("MFA recovery codes generated", { uid, tenantId });

    return res.json({ codes });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    logger.error("generateRecoveryCodesHandler failed", { message });
    return res.status(500).json({ message: "Falha ao gerar códigos de recuperação." });
  }
};

export const getRecoveryCodesStatusHandler = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const uid = req.user!.uid;

    const snap = await db.collection(RECOVERY_CODES_COLLECTION).doc(uid).get();
    if (!snap.exists) {
      return res.json({ total: 0, remaining: 0 });
    }

    const data = snap.data() as RecoveryCodesDoc;
    const codes = data.codes ?? [];
    const generatedAt = data.generatedAt?.toDate?.().toISOString();

    return res.json({
      total: codes.length,
      remaining: countRemaining(codes),
      ...(generatedAt ? { generatedAt } : {}),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    logger.error("getRecoveryCodesStatusHandler failed", { message });
    return res.status(500).json({ message: "Falha ao consultar códigos de recuperação." });
  }
};

export const verifyRecoveryCodeHandler = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const uid = req.user!.uid;
    const tenantId = req.user!.tenantId;

    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ verified: false, message: "Código de recuperação inválido." });
    }

    const codeRef = db.collection(RECOVERY_CODES_COLLECTION).doc(uid);

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(codeRef);
      if (!snap.exists) {
        return { verified: false as const, remaining: 0 };
      }

      const data = snap.data() as RecoveryCodesDoc;
      const codes = data.codes ?? [];
      const match = verifyRecoveryCode(
        parsed.data.code,
        codes as HashedRecoveryCode[],
      );
      if (!match) {
        return { verified: false as const, remaining: countRemaining(codes) };
      }

      const updatedCodes = codes.map((c, i) =>
        i === match.index ? { ...c, usedAt: Timestamp.now() } : c,
      );
      tx.update(codeRef, { codes: updatedCodes });

      return { verified: true as const, remaining: countRemaining(updatedCodes) };
    });

    if (!result.verified) {
      return res
        .status(400)
        .json({ verified: false, message: "Código de recuperação inválido." });
    }

    void writeSecurityAuditEvent({
      eventType: "recovery_code_used",
      uid,
      tenantId,
      route: req.path,
      source: "mfa_recovery_codes",
    });

    logger.info("MFA recovery code used", { uid, tenantId });

    return res.json({ verified: true, remaining: result.remaining });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    logger.error("verifyRecoveryCodeHandler failed", { message });
    return res.status(500).json({ message: "Falha ao verificar código de recuperação." });
  }
};
