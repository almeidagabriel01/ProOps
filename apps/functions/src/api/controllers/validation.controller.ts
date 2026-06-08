import { Request, Response } from "express";
import { auth, db } from "../../init";
import {
  normalizeBrazilPhoneNumber,
  normalizeEmail,
  validateBrazilMobilePhone,
  validateEmailForSignup,
  withTimeout,
} from "../../lib/contact-validation";

// Looks up whether an email is already registered, bounded by a timeout so a
// slow Auth response can't hang the request. A timeout or any non-fatal lookup
// error is treated as "not registered" — the authoritative re-check at signup
// submit still runs, so a false negative here never lets a duplicate through.
async function emailAlreadyExists(normalizedEmail: string): Promise<boolean> {
  try {
    await withTimeout(auth.getUserByEmail(normalizedEmail), 3000);
    return true;
  } catch {
    return false;
  }
}

export const validateContactForSignup = async (req: Request, res: Response) => {
  try {
    const { email, phoneNumber } = req.body || {};

    if (email === undefined && phoneNumber === undefined) {
      return res.status(400).json({
        message: "Informe ao menos email ou telefone para validação.",
      });
    }

    let emailResult:
      | {
          valid: boolean;
          exists: boolean;
          normalized?: string;
          reason?: string;
        }
      | undefined;

    if (email !== undefined) {
      // Run the domain/syntax validation and the existence lookup concurrently
      // — they're independent, so total time is the slower of the two instead
      // of their sum.
      const [emailValidation, alreadyExists] = await Promise.all([
        validateEmailForSignup(email),
        emailAlreadyExists(normalizeEmail(email)),
      ]);

      emailResult = {
        valid: emailValidation.valid,
        exists: false,
        normalized: emailValidation.normalizedEmail,
        reason: emailValidation.reason,
      };

      // Preserve the original precedence: only surface "already registered"
      // once syntax + domain checks pass.
      if (emailValidation.valid && alreadyExists) {
        emailResult.exists = true;
        emailResult.valid = false;
        emailResult.reason = "Este email já está cadastrado no sistema.";
      }
    }

    let phoneResult:
      | {
          valid: boolean;
          exists: boolean;
          normalized?: string;
          reason?: string;
        }
      | undefined;

    if (phoneNumber !== undefined) {
      const phoneValidation = validateBrazilMobilePhone(phoneNumber);
      const normalizedPhone = normalizeBrazilPhoneNumber(phoneNumber);

      phoneResult = {
        valid: phoneValidation.valid,
        exists: false,
        normalized: normalizedPhone || undefined,
        reason: phoneValidation.reason,
      };

      if (phoneValidation.valid && normalizedPhone) {
        const phoneIndexSnap = await db
          .collection("phoneNumberIndex")
          .doc(normalizedPhone)
          .get();

        if (phoneIndexSnap.exists) {
          phoneResult.exists = true;
          phoneResult.valid = false;
          phoneResult.reason = "Este telefone já está vinculado a outro usuário.";
        }
      }
    }

    return res.status(200).json({
      success: true,
      email: emailResult,
      phoneNumber: phoneResult,
    });
  } catch (error: unknown) {
    console.error("validateContactForSignup Error:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao validar contato.";
    return res.status(500).json({ message });
  }
};
