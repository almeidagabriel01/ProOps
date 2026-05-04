import { db } from "../../../init";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { SessionData } from "./whatsapp.types";
import { sendWhatsAppMessage } from "./whatsapp.api";
import { getCurrentMonthKey } from "./whatsapp.utils";

const SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MINUTE = Number(process.env.WHATSAPP_MINUTE_LIMIT) || 10;
const RATE_LIMIT_DAY = Number(process.env.WHATSAPP_DAILY_LIMIT) || 200;
const MONTHLY_LIMIT = Number(process.env.WHATSAPP_MONTHLY_LIMIT) || 2000;

export async function getOrCreateSession(
  phoneNumber: string,
  userId: string,
): Promise<SessionData> {
  const sessionRef = db.collection("whatsappSessions").doc(phoneNumber);
  const sessionSnap = await sessionRef.get();

  const now = Date.now();

  if (sessionSnap.exists) {
    const data = sessionSnap.data() as SessionData;
    let expiresAt = 0;
    if (data.expiresAt instanceof Timestamp) {
      expiresAt = data.expiresAt.toMillis();
    } else if (typeof data.expiresAt === "number") {
      expiresAt = data.expiresAt;
    }

    if (now > expiresAt) {
      return {
        phoneNumber,
        userId,
        lastAction: "idle",
        expiresAt: now + SESSION_TIMEOUT_MS,
      };
    }

    return data;
  }

  const newSession: SessionData = {
    phoneNumber,
    userId,
    lastAction: "idle",
    expiresAt: now + SESSION_TIMEOUT_MS,
  };

  await sessionRef.set({
    ...newSession,
    expiresAt: Timestamp.fromMillis(newSession.expiresAt as number),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return newSession;
}

export async function updateSession(
  phoneNumber: string,
  data: Partial<SessionData>,
) {
  const sessionRef = db.collection("whatsappSessions").doc(phoneNumber);
  const now = Date.now();

  await sessionRef.set(
    {
      ...data,
      expiresAt: Timestamp.fromMillis(now + SESSION_TIMEOUT_MS),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export async function logAction(
  phoneNumber: string,
  userId: string,
  action: string,
  details?: any,
) {
  try {
    // Truncate details to prevent oversized documents
    let safeDetails = {};
    if (details) {
      try {
        const serialized = JSON.stringify(details);
        safeDetails =
          serialized.length > 2000
            ? JSON.parse(serialized.slice(0, 2000) + '"}')
            : details;
      } catch {
        safeDetails = { raw: String(details).slice(0, 500) };
      }
    }

    await db.collection("whatsappLogs").add({
      phoneNumber,
      userId,
      action,
      details: safeDetails,
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("Error logging action:", error);
  }
}

export async function checkRateLimit(phoneNumber: string): Promise<boolean> {
  const ref = db.collection("whatsappRateLimit").doc(phoneNumber);

  // Use Firestore transaction for atomic read-then-write (prevents race conditions under burst)
  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const now = new Date();

    let data = snap.exists
      ? snap.data()!
      : {
          minuteWindowStart: Timestamp.fromDate(now),
          minuteCount: 0,
          dayWindowStart: Timestamp.fromDate(now),
          dayCount: 0,
        };

    const minStart =
      data.minuteWindowStart instanceof Timestamp
        ? data.minuteWindowStart.toMillis()
        : now.getTime();
    const dayStart =
      data.dayWindowStart instanceof Timestamp
        ? data.dayWindowStart.toMillis()
        : now.getTime();

    if (now.getTime() - minStart > 60 * 1000) {
      data.minuteWindowStart = Timestamp.fromDate(now);
      data.minuteCount = 1;
    } else {
      data.minuteCount = (data.minuteCount || 0) + 1;
    }

    if (now.getTime() - dayStart > 24 * 60 * 60 * 1000) {
      data.dayWindowStart = Timestamp.fromDate(now);
      data.dayCount = 1;
    } else {
      data.dayCount = (data.dayCount || 0) + 1;
    }

    transaction.set(ref, data, { merge: true });

    if (data.minuteCount > RATE_LIMIT_MINUTE) {
      return false;
    }

    if (data.dayCount > RATE_LIMIT_DAY) {
      return false;
    }

    return true;
  });
}

export async function checkUsage(
  companyId: string,
  limitOverride?: number,
  allowOverage?: boolean,
): Promise<boolean> {
  const currentMonth = getCurrentMonthKey();
  const ref = db
    .collection("whatsappUsage")
    .doc(companyId)
    .collection("months")
    .doc(currentMonth);
  const snap = await ref.get();

  const limit = limitOverride ?? MONTHLY_LIMIT;

  if (snap.exists) {
    const data = snap.data()!;

    if (allowOverage) {
      return true;
    }

    if ((data.totalMessages || 0) >= limit) {
      return false;
    }
  }

  return true;
}

export async function incrementUsage(
  companyId: string,
  limitOverride?: number,
  userPhoneNumber?: string,
) {
  const currentMonth = getCurrentMonthKey();
  const ref = db
    .collection("whatsappUsage")
    .doc(companyId)
    .collection("months")
    .doc(currentMonth);

  const snap = await ref.get();
  const limit = limitOverride ?? MONTHLY_LIMIT;

  let newData;
  let alertToSend: string | null = null;

  if (!snap.exists) {
    newData = {
      companyId,
      month: currentMonth,
      totalMessages: 1,
      includedMessages: 1,
      includedLimit: limit,
      overageMessages: 0,
      eightyPercentAlertSent: false,
      limitReachedAlertSent: false,
      stripeReported: false,
      updatedAt: FieldValue.serverTimestamp(),
    };
  } else {
    const data = snap.data()!;
    const newTotal = (data.totalMessages || 0) + 1;

    let overageMessages = 0;
    let includedMessages = newTotal;

    if (newTotal > limit) {
      overageMessages = newTotal - limit;
      includedMessages = limit;
    }

    let eightyPercentAlertSent = data.eightyPercentAlertSent === true;
    let limitReachedAlertSent = data.limitReachedAlertSent === true;

    if (newTotal >= limit * 0.8 && !eightyPercentAlertSent) {
      alertToSend = `⚠️ Alerta de Uso: Você atingiu 80% do seu limite mensal de WhatsApp (${newTotal}/${limit}). Fique atento!`;
      eightyPercentAlertSent = true;
    }

    if (newTotal > limit && !limitReachedAlertSent) {
      alertToSend = `🚫 Seu limite mensal foi atingido (${limit} mensagens). O uso excedente será cobrado no próximo ciclo.`;
      limitReachedAlertSent = true;
    }

    newData = {
      totalMessages: newTotal,
      includedLimit: limit,
      includedMessages,
      overageMessages,
      eightyPercentAlertSent,
      limitReachedAlertSent,
      updatedAt: FieldValue.serverTimestamp(),
    };
  }

  await ref.set(newData, { merge: true });

  if (alertToSend && userPhoneNumber) {
    await sendWhatsAppMessage(userPhoneNumber, alertToSend);
    await logAction(userPhoneNumber, "system", "usage_alert_sent", {
      message: alertToSend,
    });
  }
}
