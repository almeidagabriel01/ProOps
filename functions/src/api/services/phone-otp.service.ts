import crypto from "crypto";
import { db } from "../../init";
import { sendWhatsAppAuthTemplate } from "../services/whatsapp/whatsapp.api";
import { normalizePhoneNumber } from "../services/whatsapp/whatsapp.utils";

const OTP_COLLECTION = "phoneOtp";
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 3;
const OTP_SEND_COOLDOWN_MS = 60 * 1000; // 1 minute between sends

interface OtpDoc {
  code: string;
  phone: string;
  expiresAt: number; // epoch ms
  attempts: number;
  createdAt: number;
}

/**
 * Generates a cryptographically random 6-digit numeric code.
 */
function generateOtpCode(): string {
  const bytes = crypto.randomBytes(4);
  const num = bytes.readUInt32BE(0) % 1_000_000;
  return String(num).padStart(6, "0");
}

/**
 * Sends a WhatsApp OTP to the given phone number.
 * Stores the code in Firestore under phoneOtp/{uid}.
 * Rate-limits to 1 send per minute per user.
 *
 * @throws Error with code OTP_COOLDOWN if sending too soon
 */
export async function sendOtp(uid: string, rawPhone: string): Promise<void> {
  const phone = normalizePhoneNumber(rawPhone);
  if (!phone || phone.replace(/\D/g, "").length < 12) {
    throw Object.assign(new Error("Número de telefone inválido."), {
      code: "INVALID_PHONE",
    });
  }

  const docRef = db.collection(OTP_COLLECTION).doc(uid);
  const existing = await docRef.get();

  if (existing.exists) {
    const data = existing.data() as OtpDoc;
    const elapsed = Date.now() - (data.createdAt || 0);
    if (elapsed < OTP_SEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((OTP_SEND_COOLDOWN_MS - elapsed) / 1000);
      throw Object.assign(
        new Error(`Aguarde ${waitSeconds}s antes de solicitar um novo código.`),
        { code: "OTP_COOLDOWN", waitSeconds },
      );
    }
  }

  const code = generateOtpCode();
  const now = Date.now();

  await docRef.set({
    code,
    phone,
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    createdAt: now,
  } satisfies OtpDoc);

  await sendWhatsAppAuthTemplate(phone, code);
}

/**
 * Verifies the OTP entered by the user.
 * Increments the attempt counter on failure.
 * Deletes the doc on success.
 *
 * @throws Error with code OTP_INVALID | OTP_EXPIRED | OTP_MAX_ATTEMPTS | OTP_NOT_FOUND
 * @returns The verified phone number in normalized form
 */
export async function verifyOtp(
  uid: string,
  inputCode: string,
): Promise<string> {
  const docRef = db.collection(OTP_COLLECTION).doc(uid);
  const snap = await docRef.get();

  if (!snap.exists) {
    throw Object.assign(
      new Error(
        "Nenhum código foi solicitado. Clique em 'Receber Código' primeiro.",
      ),
      { code: "OTP_NOT_FOUND" },
    );
  }

  const data = snap.data() as OtpDoc;

  if (Date.now() > data.expiresAt) {
    await docRef.delete();
    throw Object.assign(new Error("Código expirado. Solicite um novo."), {
      code: "OTP_EXPIRED",
    });
  }

  if (data.attempts >= MAX_ATTEMPTS) {
    await docRef.delete();
    throw Object.assign(
      new Error(
        "Número máximo de tentativas atingido. Solicite um novo código.",
      ),
      { code: "OTP_MAX_ATTEMPTS" },
    );
  }

  // Timing-safe comparison to prevent timing attacks
  const expected = Buffer.from(data.code, "utf8");
  const received = Buffer.from(String(inputCode || "").trim(), "utf8");
  const isValid =
    expected.length === received.length &&
    crypto.timingSafeEqual(expected, received);

  if (!isValid) {
    await docRef.update({ attempts: data.attempts + 1 });
    const remaining = MAX_ATTEMPTS - (data.attempts + 1);
    throw Object.assign(
      new Error(
        remaining > 0
          ? `Código incorreto. ${remaining} tentativa(s) restante(s).`
          : "Código incorreto. Solicite um novo código.",
      ),
      { code: "OTP_INVALID", remaining },
    );
  }

  // Success — clean up
  await docRef.delete();
  return data.phone;
}
