import { Request, Response } from "express";
import { sendOtp, verifyOtp } from "../services/phone-otp.service";
import { normalizePhoneNumber } from "../services/whatsapp/whatsapp.utils";
import { db } from "../../init";
import { upsertPhoneNumberIndexTx } from "./admin.controller";
import { Timestamp } from "firebase-admin/firestore";

/**
 * POST /v1/phone-otp/send
 * Body: { phoneNumber: string }
 *
 * Generates a 6-digit OTP, stores it in Firestore, and sends it via WhatsApp.
 */
export const sendPhoneOtp = async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;
    const { phoneNumber } = req.body as { phoneNumber?: string };

    if (!phoneNumber || typeof phoneNumber !== "string") {
      return res.status(400).json({ message: "Informe o número de telefone." });
    }

    await sendOtp(uid, phoneNumber);

    return res.json({
      success: true,
      message: "Código enviado via WhatsApp.",
    });
  } catch (err: any) {
    console.error("[phone-otp] sendPhoneOtp error:", err);

    if (err?.code === "INVALID_PHONE") {
      return res.status(400).json({ message: err.message });
    }
    if (err?.code === "OTP_COOLDOWN") {
      return res.status(429).json({
        message: err.message,
        waitSeconds: err.waitSeconds,
      });
    }

    return res
      .status(500)
      .json({ message: "Erro ao enviar código. Tente novamente." });
  }
};

/**
 * POST /v1/phone-otp/verify
 * Body: { code: string }
 *
 * Validates the OTP. On success, saves the verified phone number to the user's profile.
 */
export const verifyPhoneOtp = async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;
    const { code } = req.body as { code?: string };

    if (!code || typeof code !== "string" || code.trim().length !== 6) {
      return res
        .status(400)
        .json({ message: "Informe o código de 6 dígitos." });
    }

    // verifyOtp returns the verified phone number and deletes the OTP doc
    const verifiedPhone = await verifyOtp(uid, code.trim());

    // Persist the phone number in the user's Firestore profile
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    const userData = userSnap.data()!;
    const now = Timestamp.now();
    const normalizedPhone = normalizePhoneNumber(verifiedPhone);

    await db.runTransaction(async (transaction) => {
      await upsertPhoneNumberIndexTx(transaction, {
        userId: uid,
        tenantId: userData.tenantId || userData.companyId || "",
        newPhoneNumber: normalizedPhone,
        previousPhoneNumber: userData.phoneNumber,
        now,
      });
      transaction.update(userRef, {
        phoneNumber: normalizedPhone,
        phoneVerifiedAt: now,
        updatedAt: now,
      });
    });

    return res.json({
      success: true,
      message: "Telefone verificado com sucesso.",
      phoneNumber: normalizedPhone,
    });
  } catch (err: any) {
    console.error("[phone-otp] verifyPhoneOtp error:", err);

    const knownCodes = [
      "OTP_NOT_FOUND",
      "OTP_EXPIRED",
      "OTP_MAX_ATTEMPTS",
      "OTP_INVALID",
    ];

    if (knownCodes.includes(err?.code)) {
      return res.status(400).json({ message: err.message });
    }
    if (err?.message === "PHONE_ALREADY_LINKED") {
      return res
        .status(409)
        .json({ message: "Este telefone já está vinculado a outro usuário." });
    }

    return res
      .status(500)
      .json({ message: "Erro ao verificar código. Tente novamente." });
  }
};
