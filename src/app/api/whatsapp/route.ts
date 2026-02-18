import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/firebase"; // Keep Client SDK for storage if needed, or switch later
import { ref, getDownloadURL } from "firebase/storage";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import crypto from "crypto";

// ============================================
// INIT ADMIN DB
// ============================================
const db = getAdminFirestore();

// ============================================
// TYPES
// ============================================

interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  text: {
    body: string;
  };
  type: string;
}

interface WebhookPayload {
  object: string;
  entry: {
    id: string;
    changes: {
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts: {
          profile: {
            name: string;
          };
          wa_id: string;
        }[];
        messages: WhatsAppMessage[];
      };
      field: string;
    }[];
  }[];
}

interface SessionData {
  phoneNumber: string;
  userId: string;
  lastAction: "idle" | "awaiting_proposal_selection";
  proposalsShown?: { id: string; index: number }[]; // Store mapping of Index -> ID
  expiresAt: number | Timestamp;
}

// ============================================
// CONFIG & CONSTANTS
// ============================================

const SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Verifies the X-Hub-Signature-256 header.
 */
function verifyWhatsAppSignature(
  rawBody: string,
  signature: string | null,
  appSecret: string,
): boolean {
  if (!signature) {
    return false;
  }

  const parts = signature.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") {
    return false;
  }

  const sigHash = parts[1];
  const expectedHash = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");

  const sigBuffer = Buffer.from(sigHash, "utf8");
  const expectedBuffer = Buffer.from(expectedHash, "utf8");

  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

async function sendWhatsAppMessage(to: string, body: string) {
  console.log(`[WhatsApp] Sending to ${to}: ${body}`);
  // Temporary logging for verification
  // Removed
}

async function sendWhatsAppPdf(to: string, link: string, caption: string) {
  console.log(`[WhatsApp] Sending PDF to ${to}: ${link}`);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (typeof value === "object" && value !== null) {
    const maybeTs = value as { toDate?: () => Date };
    if (typeof maybeTs.toDate === "function") {
      const parsed = maybeTs.toDate();
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }
  return null;
}

function normalizeTransactionType(
  rawType: unknown,
  rawAmount: number,
): "income" | "expense" {
  const type = String(rawType || "")
    .toLowerCase()
    .trim();

  if (
    ["income", "entrada", "deposit", "deposito", "transfer_in", "credit"].some(
      (k) => type.includes(k),
    )
  ) {
    return "income";
  }

  if (
    ["expense", "saida", "withdrawal", "transfer_out", "debit"].some((k) =>
      type.includes(k),
    )
  ) {
    return "expense";
  }

  return rawAmount < 0 ? "expense" : "income";
}

type ProposalListItem = {
  id: string;
  clientName: string;
  title?: string;
  totalValue: number;
  status: string;
};

type NormalizedTransaction = {
  id: string;
  type: "income" | "expense";
  amount: number;
};

async function getLatestProposalsForTenant(
  tenantId: string,
  limitN = 10,
): Promise<ProposalListItem[]> {
  const base = db.collection("proposals").where("tenantId", "==", tenantId);

  const runQuery = async (sortField?: "createdAt" | "updatedAt") => {
    try {
      const q = sortField
        ? base.orderBy(sortField, "desc").limit(limitN)
        : base.limit(limitN);
      return await q.get();
    } catch (error) {
      console.warn(
        `[WhatsApp] Failed proposals query (sort=${sortField || "none"})`,
        error,
      );
      return null;
    }
  };

  const snap =
    (await runQuery("createdAt")) ||
    (await runQuery("updatedAt")) ||
    (await runQuery());

  if (!snap || snap.empty) {
    return [];
  }

  return snap.docs.map((doc) => {
    const data = doc.data() as any;
    const clientName =
      String(data.clientName || "").trim() ||
      String(data.client?.name || "").trim() ||
      String(data.title || "").trim() ||
      "Sem cliente";
    const totalValue = toNumber(data.totalValue ?? data.total ?? data.value);
    return {
      id: doc.id,
      clientName,
      title: data.title ? String(data.title) : undefined,
      totalValue,
      status: String(data.status || "unknown"),
    };
  });
}

async function getProposalByIdForTenant(
  tenantId: string,
  proposalId: string,
): Promise<{ id: string; [key: string]: unknown } | null> {
  const trimmedId = String(proposalId || "").trim();
  if (!trimmedId) return null;

  const docRef = db.collection("proposals").doc(trimmedId);
  const docSnap = await docRef.get();

  if (!docSnap.exists) return null;

  const data = docSnap.data() as any;
  if (!data || data.tenantId !== tenantId) return null;

  return { id: docSnap.id, ...data };
}

async function getTransactionsFromCollection(
  collectionName: "transactions" | "wallet_transactions",
  tenantId: string,
  start: Date,
  end: Date,
): Promise<NormalizedTransaction[]> {
  const startTs = Timestamp.fromDate(start);
  const endTs = Timestamp.fromDate(end);
  const collectionRef = db.collection(collectionName);

  let docs: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>[] =
    [];

  try {
    const ranged = await collectionRef
      .where("tenantId", "==", tenantId)
      .where("createdAt", ">=", startTs)
      .where("createdAt", "<", endTs)
      .get();
    docs = ranged.docs;
  } catch (error) {
    console.warn(
      `[WhatsApp] Failed ${collectionName} range query, using fallback`,
      error,
    );
    try {
      const fallback = await collectionRef.where("tenantId", "==", tenantId).get();
      docs = fallback.docs.filter((doc) => {
        const data = doc.data() as any;
        const createdAt = toDate(data.createdAt);
        const dateValue = toDate(data.date);
        const txDate = createdAt || dateValue;
        return !!txDate && txDate >= start && txDate < end;
      });
    } catch (fallbackError) {
      console.warn(
        `[WhatsApp] Failed ${collectionName} fallback query`,
        fallbackError,
      );
      return [];
    }
  }

  return docs.map((doc) => {
    const data = doc.data() as any;
    const rawAmount = toNumber(data.amount ?? data.value);
    const amountAbs = Math.abs(rawAmount);
    return {
      id: doc.id,
      type: normalizeTransactionType(data.type, rawAmount),
      amount: amountAbs,
    };
  });
}

async function getTodaysTransactions(
  tenantId: string,
  start: Date,
  end: Date,
): Promise<NormalizedTransaction[]> {
  const fromTransactions = await getTransactionsFromCollection(
    "transactions",
    tenantId,
    start,
    end,
  );
  if (fromTransactions.length > 0) return fromTransactions;

  const fromWalletTransactions = await getTransactionsFromCollection(
    "wallet_transactions",
    tenantId,
    start,
    end,
  );
  if (fromWalletTransactions.length > 0) return fromWalletTransactions;

  return [];
}

async function getWalletSummary(tenantId: string): Promise<{ totalBalance: number }> {
  try {
    const snap = await db
      .collection("wallets")
      .where("tenantId", "==", tenantId)
      .get();

    if (snap.empty) {
      return { totalBalance: 0 };
    }

    const totalBalance = snap.docs.reduce((acc, doc) => {
      const data = doc.data() as any;
      return acc + toNumber(data.balance ?? data.amount);
    }, 0);

    return { totalBalance };
  } catch (error) {
    console.error("[WhatsApp] Error fetching wallet summary:", error);
    return { totalBalance: 0 };
  }
}

// --- SESSION MANAGEMENT ---

async function getOrCreateSession(
  phoneNumber: string,
  userId: string,
): Promise<SessionData> {
  const sessionRef = db.collection("whatsappSessions").doc(phoneNumber);
  const sessionSnap = await sessionRef.get();

  const now = Date.now();

  if (sessionSnap.exists) {
    const data = sessionSnap.data() as SessionData;
    // Check expiration (Firestore Timestamp to millis)
    // Admin SDK Timestamp has toMillis()
    let expiresAt = 0;
    if (data.expiresAt instanceof Timestamp) {
      expiresAt = data.expiresAt.toMillis();
    } else if (typeof data.expiresAt === "number") {
      expiresAt = data.expiresAt;
    }

    if (now > expiresAt) {
      // Expired: Reset
      return {
        phoneNumber,
        userId,
        lastAction: "idle",
        expiresAt: now + SESSION_TIMEOUT_MS,
      };
    }

    return data;
  }

  // Create new
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

async function updateSession(phoneNumber: string, data: Partial<SessionData>) {
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

async function logAction(
  phoneNumber: string,
  userId: string,
  action: string,
  details?: any,
) {
  try {
    await db.collection("whatsappLogs").add({
      phoneNumber,
      userId,
      action,
      details: details || {},
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("Error logging action:", error);
  }
}

// --- RATE LIMIT & USAGE CONTROL ---

const RATE_LIMIT_MINUTE = Number(process.env.WHATSAPP_MINUTE_LIMIT) || 10;
const RATE_LIMIT_DAY = Number(process.env.WHATSAPP_DAILY_LIMIT) || 200;
const MONTHLY_LIMIT = Number(process.env.WHATSAPP_MONTHLY_LIMIT) || 2000;
const COST_PER_MSG = Number(process.env.WHATSAPP_COST_PER_MESSAGE) || 0.35;

/**
 * Checks and updates the rate limit for a phone number.
 * Returns true if allowed, false if blocked.
 */
async function checkRateLimit(phoneNumber: string): Promise<boolean> {
  const now = new Date();
  const ref = db.collection("whatsappRateLimit").doc(phoneNumber);
  const snap = await ref.get();

  let data = snap.exists
    ? snap.data()!
    : {
        minuteWindowStart: Timestamp.fromDate(now),
        minuteCount: 0,
        dayWindowStart: Timestamp.fromDate(now),
        dayCount: 0,
      };

  // Convert timestamps to millis for logic
  const minStart =
    data.minuteWindowStart instanceof Timestamp
      ? data.minuteWindowStart.toMillis()
      : now.getTime();
  const dayStart =
    data.dayWindowStart instanceof Timestamp
      ? data.dayWindowStart.toMillis()
      : now.getTime();

  // Minute Window Logic
  if (now.getTime() - minStart > 60 * 1000) {
    // Reset window
    data.minuteWindowStart = Timestamp.fromDate(now);
    data.minuteCount = 1;
  } else {
    data.minuteCount = (data.minuteCount || 0) + 1;
  }

  // Day Window Logic
  if (now.getTime() - dayStart > 24 * 60 * 60 * 1000) {
    // Reset window
    data.dayWindowStart = Timestamp.fromDate(now);
    data.dayCount = 1;
  } else {
    data.dayCount = (data.dayCount || 0) + 1;
  }

  // Update DB immediately
  await ref.set(data, { merge: true });

  // Check Limits
  if (data.minuteCount > RATE_LIMIT_MINUTE) {
    console.log(`Rate limit exceeded (minute) for ${phoneNumber}`);
    return false;
  }

  if (data.dayCount > RATE_LIMIT_DAY) {
    console.log(`Rate limit exceeded (day) for ${phoneNumber}`);
    return false;
  }

  return true;
}

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Checks if the tenant has exceeded their monthly quota.
 * Returns true if allowed, false if blocked.
 */
async function checkUsage(
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

  // Use tenant limit if present, otherwise default to global limit
  const limit = limitOverride ?? MONTHLY_LIMIT;

  if (snap.exists) {
    const data = snap.data()!;

    // If overage is allowed, we don't block
    if (allowOverage) {
      return true;
    }

    if ((data.totalMessages || 0) >= limit) {
      return false;
    }
  }

  // If no doc for this month exists, usage is 0, so allowed.
  return true;
}

/**
 * Increments the usage usage for the tenant and calculates costs.
 * Checks for thresholds (80%, 100%) and sends alerts if needed.
 */
async function incrementUsage(
  companyId: string,
  limitOverride?: number,
  userPhoneNumber?: string,
) {
  const currentMonth = getCurrentMonthKey();
  // New Path: whatsappUsage/{tenantId}/months/{YYYY-MM}
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
    // Start of new month (or first ever message for this month)
    // No reset needed, just create new doc.
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

    // Increment
    const newTotal = (data.totalMessages || 0) + 1;

    let overageMessages = 0;
    let includedMessages = newTotal;

    if (newTotal > limit) {
      overageMessages = newTotal - limit;
      includedMessages = limit;
    }

    // Preserve existing flags
    let eightyPercentAlertSent = data.eightyPercentAlertSent === true;
    let limitReachedAlertSent = data.limitReachedAlertSent === true;

    // Check Alerts
    // 1. 80% Alert
    if (newTotal >= limit * 0.8 && !eightyPercentAlertSent) {
      alertToSend = `⚠️ Alerta de Uso: Você atingiu 80% do seu limite mensal de WhatsApp (${newTotal}/${limit}). Fique atento!`;
      eightyPercentAlertSent = true;
    }

    // 2. 100% Alert (Start of Overage)
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

// ============================================
// ROUTE HANDLER
// ============================================

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!VERIFY_TOKEN) {
    console.error("WHATSAPP_VERIFY_TOKEN is not defined");
    return new NextResponse("Internal Server Error", { status: 500 });
  }

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("WEBHOOK_VERIFIED");
      return new NextResponse(challenge, { status: 200 });
    } else {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  return new NextResponse("Hello WhatsApp", { status: 200 });
}

export async function POST(req: NextRequest) {
  try {
    const APP_SECRET = process.env.WHATSAPP_APP_SECRET;

    if (!APP_SECRET) {
      console.error("WHATSAPP_APP_SECRET is not defined");
      return new NextResponse("Server Configuration Error", { status: 500 });
    }

    const signature = req.headers.get("x-hub-signature-256");
    const rawBody = await req.text();

    if (!verifyWhatsAppSignature(rawBody, signature, APP_SECRET)) {
      console.log("Invalid WhatsApp signature");
      return new NextResponse("Invalid signature", { status: 401 });
    }

    const body = JSON.parse(rawBody) as WebhookPayload;

    if (body.object === "whatsapp_business_account") {
      if (
        body.entry &&
        body.entry[0].changes &&
        body.entry[0].changes[0].value.messages &&
        body.entry[0].changes[0].value.messages[0]
      ) {
        const message = body.entry[0].changes[0].value.messages[0];
        const from = message.from;
        const text = message.text?.body || "";

        // 1. Check Rate Limit (Before DB user lookup to save reads if spammed)
        const isRateLimitOk = await checkRateLimit(from);
        if (!isRateLimitOk) {
          await sendWhatsAppMessage(
            from,
            "⏳ Limite temporário de uso atingido. Tente novamente em alguns minutos.",
          );
          return new NextResponse("OK", { status: 200 });
        }

        // 2. Authenticate User
        // Use Admin SDK directly to avoid permission issues with Client SDK in UserService
        const usersRef = db.collection("users");

        // query for phone number. Note: key might be phoneNumber or phone depending on schema.
        // Based on create-test-user.js, it is "phoneNumber".
        const userSnap = await usersRef
          .where("phoneNumber", "==", from)
          .limit(1)
          .get();

        let user: any = null;
        if (!userSnap.empty) {
          user = { id: userSnap.docs[0].id, ...userSnap.docs[0].data() };
        }

        if (!user || user.status === "inactive" || !user.tenantId) {
          await sendWhatsAppMessage(
            from,
            "Seu número não está vinculado a uma conta ativa ou empresa. Entre em contato com o administrador.",
          );
          return new NextResponse("OK", { status: 200 });
        }

        const tenantId = user.tenantId;

        // 3. FEATURE FLAG CHECK & TENANT LIMITS
        const tenantRef = db.collection("tenants").doc(tenantId);
        const tenantSnap = await tenantRef.get();

        if (!tenantSnap.exists) {
          return new NextResponse("OK", { status: 200 });
        }

        const tenantData = tenantSnap.data()!;

        // Check if Enabled

        if (tenantData.whatsappEnabled !== true) {
          await sendWhatsAppMessage(
            from,
            "🚫 O WhatsApp não está habilitado para sua empresa. Entre em contato com o administrador.",
          );
          return new NextResponse("OK", { status: 200 });
        }

        // Check Monthly Usage with specific limit using Overage Logic
        const limit = tenantData.whatsappMonthlyLimit || MONTHLY_LIMIT;
        const allowOverage = tenantData.whatsappAllowOverage === true;

        const isUsageOk = await checkUsage(tenantId, limit, allowOverage);

        if (!isUsageOk) {
          await sendWhatsAppMessage(
            from,
            "⚠️ O limite mensal de uso do WhatsApp foi atingido. Entre em contato com o administrador.",
          );
          return new NextResponse("OK", { status: 200 });
        }

        const normalizedText = text.toLowerCase().trim();

        // 4. Get/Create Session
        const session = await getOrCreateSession(from, user.id);

        let actionProcessed = false;

        // 5. Logic Router

        // A. List Proposals
        if (
          ["ver propostas", "minhas propostas", "listar propostas"].some((t) =>
            normalizedText.includes(t),
          )
        ) {
          await handleListProposals(from, tenantId, user.id);
          actionProcessed = true;
        }

        // B. Contextual Selection (Number or #ID)
        else if (/^#?(\d+)$/.test(normalizedText)) {
          const inputId = normalizedText.replace("#", "").trim();

          let handled = false;
          // If session is waiting for selection and input is a small integer (1-10)
          if (
            session.lastAction === "awaiting_proposal_selection" &&
            session.proposalsShown
          ) {
            const index = parseInt(inputId);
            const selected = session.proposalsShown.find(
              (p) => p.index === index,
            );

            if (selected) {
              await handleSendPdf(from, tenantId, selected.id, user.id);
              handled = true;
            }
          }

          if (!handled) {
            // Fallback: Try as direct ID
            await handleSendPdf(from, tenantId, inputId, user.id);
          }
          actionProcessed = true;
        }

        // C. Financial Summary
        else if (
          ["financeiro de hoje", "resumo de hoje", "movimento do dia"].some(
            (t) => normalizedText.includes(t),
          )
        ) {
          // Role Check
          if (!["admin", "superadmin"].includes(user.role)) {
            await sendWhatsAppMessage(
              from,
              "Você não tem permissão para acessar informações financeiras pelo WhatsApp.",
            );
            await logAction(from, user.id, "unauthorized_access_attempt", {
              target: "financial_summary",
            });
          } else {
            await handleFinancialDaySummary(from, tenantId, user.id);
          }
          actionProcessed = true;
        }

        // D. Balance
        else if (
          ["saldo", "saldo atual", "quanto tenho", "caixa"].some((t) =>
            normalizedText.includes(t),
          )
        ) {
          // Role Check
          if (!["admin", "superadmin"].includes(user.role)) {
            await sendWhatsAppMessage(
              from,
              "Você não tem permissão para acessar o saldo pelo WhatsApp.",
            );
            await logAction(from, user.id, "unauthorized_access_attempt", {
              target: "balance",
            });
          } else {
            await handleCurrentBalance(from, tenantId, user.id);
          }
          actionProcessed = true;
        }

        // E. Fallback / Greeting
        else {
          if (
            ["cadastrar", "editar", "criar", "alterar", "excluir"].some((t) =>
              normalizedText.includes(t),
            )
          ) {
            await sendWhatsAppMessage(
              from,
              "Essa operação não pode ser realizada pelo WhatsApp. Acesse o sistema para continuar.",
            );
          } else {
            await sendWhatsAppMessage(
              from,
              "Olá! Sou seu assistente ERP. Posso ajudar com:\n\n1️⃣ 'Ver propostas'\n2️⃣ 'Financeiro de hoje'\n3️⃣ 'Saldo atual'\n\nOu digite o número da proposta (#ID) para PDF.",
            );
            // Ensure session is reset/idle if they say something random
            await updateSession(from, {
              lastAction: "idle",
              proposalsShown: [],
            });
          }
          actionProcessed = true; // Still counts as usage since we replied
        }

        // 6. Increment Usage if something was processed/replied
        if (actionProcessed) {
          await incrementUsage(tenantId, limit, from);
        }
      }
    }

    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// ============================================
// FLOW HANDLERS
// ============================================

async function handleListProposals(
  to: string,
  tenantId: string,
  userId: string,
) {
  await logAction(to, userId, "list_proposals");

  try {
    const proposals = await getLatestProposalsForTenant(tenantId, 10);

    if (proposals.length === 0) {
      await sendWhatsAppMessage(to, "Nenhuma proposta encontrada.");
      await updateSession(to, { lastAction: "idle", proposalsShown: [] });
      return;
    }

    let msg = "📄 *Propostas recentes:*\n\n";
    const proposalsShown: { id: string; index: number }[] = [];

    proposals.forEach((p, index) => {
      const value = p.totalValue ? formatCurrency(p.totalValue) : "R$ 0,00";
      const statusMap: Record<string, string> = {
        draft: "📝 Rascunho",
        sent: "📩 Enviada",
        approved: "✅ Aprovada",
        rejected: "❌ Recusada",
        in_progress: "🕒 Em andamento",
      };
      const status = statusMap[p.status] || p.status;
      const displayIndex = index + 1;

      proposalsShown.push({ id: p.id, index: displayIndex });
      msg += `${displayIndex}️⃣ *#${p.id.slice(0, 5)}...* – ${p.clientName} – ${value} – ${status}\n`;
    });

    msg += "\nDigite o número da proposta para receber o PDF.";

    await sendWhatsAppMessage(to, msg);

    await updateSession(to, {
      lastAction: "awaiting_proposal_selection",
      proposalsShown,
    });
  } catch (error) {
    console.error("[WhatsApp] Error in handleListProposals:", error);
    await sendWhatsAppMessage(to, "Nenhuma proposta encontrada.");
    await updateSession(to, { lastAction: "idle", proposalsShown: [] });
  }
}

async function handleSendPdf(
  to: string,
  tenantId: string,
  proposalIdOrFragment: string,
  userId: string,
) {
  await logAction(to, userId, "send_pdf_attempt", {
    proposalId: proposalIdOrFragment,
  });

  try {
    const proposal = await getProposalByIdForTenant(tenantId, proposalIdOrFragment);

    if (!proposal) {
      await sendWhatsAppMessage(to, "Não encontrei a proposta.");
      await updateSession(to, { lastAction: "idle", proposalsShown: [] });
      return;
    }

    let pdfUrl: string | null = null;

    const attachments = Array.isArray(proposal.attachments)
      ? proposal.attachments
      : [];

    const pdFile = attachments.find((a: any) => {
      const name = String(a?.name || "").toLowerCase();
      const type = String(a?.type || "").toLowerCase();
      return type === "pdf" || name.endsWith(".pdf");
    });

    if (pdFile?.url) {
      pdfUrl = String(pdFile.url);
    }

    if (!pdfUrl) {
      try {
        const path = `tenants/${tenantId}/proposals/${proposal.id}/proposal.pdf`;
        const pdfRef = ref(storage, path);
        pdfUrl = await getDownloadURL(pdfRef);
      } catch {
        console.log("PDF not found in standard path");
      }
    }

    if (pdfUrl) {
      await sendWhatsAppPdf(
        to,
        pdfUrl,
        `Segue o PDF da proposta ${String(proposal.title || proposal.id)}`,
      );
      await logAction(to, userId, "send_pdf_success", {
        proposalId: proposal.id,
      });
    } else {
      await sendWhatsAppMessage(
        to,
        "O PDF desta proposta ainda não foi gerado ou anexado.",
      );
    }

    await updateSession(to, { lastAction: "idle", proposalsShown: [] });
  } catch (error) {
    console.error("[WhatsApp] Error in handleSendPdf:", error);
    await sendWhatsAppMessage(to, "Não encontrei a proposta.");
    await updateSession(to, { lastAction: "idle", proposalsShown: [] });
  }
}

async function handleFinancialDaySummary(
  to: string,
  tenantId: string,
  userId: string,
) {
  await logAction(to, userId, "view_financial_summary");

  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const todayTransactions = await getTodaysTransactions(tenantId, start, end);

    if (todayTransactions.length === 0) {
      await sendWhatsAppMessage(to, "Nenhuma movimentação hoje.");
      return;
    }

    let entries = 0;
    let exits = 0;

    todayTransactions.forEach((t) => {
      if (t.type === "income") entries += t.amount;
      if (t.type === "expense") exits += t.amount;
    });

    const balance = entries - exits;
    const sign = balance >= 0 ? "+" : "";

    const msg = `📊 *Resumo financeiro de hoje:*\n\nEntradas: ${formatCurrency(entries)}\nSaídas: ${formatCurrency(exits)}\nResultado: *${sign}${formatCurrency(balance)}*`;

    await sendWhatsAppMessage(to, msg);
  } catch (error) {
    console.error("[WhatsApp] Error in handleFinancialDaySummary:", error);
    await sendWhatsAppMessage(to, "Nenhuma movimentação hoje.");
  }
}

async function handleCurrentBalance(
  to: string,
  tenantId: string,
  userId: string,
) {
  await logAction(to, userId, "view_balance");

  try {
    const summary = await getWalletSummary(tenantId);

    if (!Number.isFinite(summary.totalBalance)) {
      await sendWhatsAppMessage(to, "Saldo indisponível no momento.");
      return;
    }

    const msg = `💰 *Saldo atual consolidado:*\n\n${formatCurrency(summary.totalBalance)}`;
    await sendWhatsAppMessage(to, msg);
  } catch (error) {
    console.error("[WhatsApp] Error in handleCurrentBalance:", error);
    await sendWhatsAppMessage(to, "Saldo indisponível no momento.");
  }
}
