import { Request, Response } from "express";
import { auth, db } from "../../init";
import {
  normalizeBrazilPhoneNumber,
  validateBrazilMobilePhone,
  validateEmailForSignup,
} from "../../lib/contact-validation";

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
      const emailValidation = await validateEmailForSignup(email);

      emailResult = {
        valid: emailValidation.valid,
        exists: false,
        normalized: emailValidation.normalizedEmail,
        reason: emailValidation.reason,
      };

      if (emailValidation.valid) {
        try {
          await auth.getUserByEmail(emailValidation.normalizedEmail);
          emailResult.exists = true;
          emailResult.valid = false;
          emailResult.reason = "Este email já está cadastrado no sistema.";
        } catch (error: unknown) {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            (error as { code: string }).code !== "auth/user-not-found"
          ) {
            throw error;
          }
        }
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
