import { Request, Response } from "express";
import crypto from "crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { jsPDF } from "jspdf";
import { db } from "../../init";

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
const PDF_URL_VALIDITY_MS = 60 * 60 * 1000; // 1 hour
const PDF_GENERATION_LOCK_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

// ============================================
// HELPER FUNCTIONS
// ============================================

function verifyWhatsAppSignature(
  rawBody: string | Buffer,
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
  // Implement actual sending logic using WhatsApp Business API if needed
}

async function sendWhatsAppPdf(to: string, link: string, caption: string) {
  console.log(`[WhatsApp] Sending PDF to ${to}: ${link}`);
  // Implement actual sending logic using WhatsApp Business API if needed
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function normalizePhoneNumber(value: unknown): string {
  return String(value || "").replace(/\D/g, "");
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
  title: string;
  clientName: string;
  totalValue: number;
  updatedAt: Date | null;
};

type NormalizedTransaction = {
  id: string;
  type: "income" | "expense";
  amount: number;
};

async function queryProposalsForTenant(
  firestore: FirebaseFirestore.Firestore,
  tenantId: string,
  limitN = 10,
): Promise<ProposalListItem[]> {
  const proposalsRef = firestore.collection("proposals");

  const runQuery = async (
    field: "tenantId" | "companyId",
  ): Promise<{
    usedField: "tenantId" | "companyId";
    snap: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>;
  } | null> => {
    try {
      const snap = await proposalsRef
        .where(field, "==", tenantId)
        .orderBy("updatedAt", "desc")
        .limit(limitN)
        .get();
      return { usedField: field, snap };
    } catch (error) {
      console.warn(`[WhatsApp] proposals query failed (${field})`, error);
      try {
        const fallbackSnap = await proposalsRef
          .where(field, "==", tenantId)
          .limit(limitN)
          .get();
        return { usedField: field, snap: fallbackSnap };
      } catch (fallbackError) {
        console.warn(
          `[WhatsApp] proposals query fallback failed (${field})`,
          fallbackError,
        );
        return null;
      }
    }
  };

  const tenantResult = await runQuery("tenantId");
  if (tenantResult && !tenantResult.snap.empty) {
    console.log("[WhatsApp] proposals found", {
      tenantId,
      count: tenantResult.snap.size,
      usedField: tenantResult.usedField,
    });
    return tenantResult.snap.docs.map((doc) => {
      const data = doc.data() as any;
      return {
        id: doc.id,
        title: String(data.title || "Proposta"),
        clientName: String(data.clientName || "").trim(),
        totalValue: toNumber(data.totalValue ?? data.total ?? data.value),
        updatedAt: toDate(data.updatedAt),
      };
    });
  }

  const companyResult = await runQuery("companyId");
  if (companyResult && !companyResult.snap.empty) {
    console.log("[WhatsApp] proposals found", {
      tenantId,
      count: companyResult.snap.size,
      usedField: companyResult.usedField,
    });
    return companyResult.snap.docs.map((doc) => {
      const data = doc.data() as any;
      return {
        id: doc.id,
        title: String(data.title || "Proposta"),
        clientName: String(data.clientName || "").trim(),
        totalValue: toNumber(data.totalValue ?? data.total ?? data.value),
        updatedAt: toDate(data.updatedAt),
      };
    });
  }

  console.log("[WhatsApp] proposals found", {
    tenantId,
    count: 0,
    usedField: "companyId",
  });
  return [];
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
  if (!data) return null;
  if (data.tenantId !== tenantId && data.companyId !== tenantId) return null;

  return { id: docSnap.id, ...data };
}

function buildProposalPdfStoragePath(
  tenantId: string,
  proposalId: string,
): string {
  return `proposals/${tenantId}/${proposalId}/proposal.pdf`;
}

function parseStoragePathFromUrl(value: string): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;

  if (raw.startsWith("proposals/")) return raw;

  if (raw.startsWith("gs://")) {
    const noProtocol = raw.slice(5);
    const firstSlash = noProtocol.indexOf("/");
    if (firstSlash > 0 && firstSlash < noProtocol.length - 1) {
      return noProtocol.slice(firstSlash + 1);
    }
  }

  try {
    const url = new URL(raw);
    const decodedPathname = decodeURIComponent(url.pathname);

    if (
      url.hostname.includes("firebasestorage.googleapis.com") ||
      url.hostname.includes("firebasestorage.app")
    ) {
      const marker = "/o/";
      const markerIndex = decodedPathname.indexOf(marker);
      if (markerIndex >= 0) {
        return decodedPathname.slice(markerIndex + marker.length);
      }
    }

    if (url.hostname.includes("storage.googleapis.com")) {
      const parts = decodedPathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        return parts.slice(1).join("/");
      }
    }
  } catch {
    return null;
  }

  return null;
}

async function isUrlAccessible(url: string): Promise<boolean> {
  const trimmedUrl = String(url || "").trim();
  if (!trimmedUrl) return false;

  try {
    const response = await fetch(trimmedUrl, { method: "HEAD" });
    if (response.ok) return true;
    if (response.status !== 405) return false;
  } catch {
    return false;
  }

  try {
    const response = await fetch(trimmedUrl, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
    });
    return response.ok || response.status === 206;
  } catch {
    return false;
  }
}

async function generateSimpleProposalPdfBuffer(proposal: {
  id: string;
  [key: string]: unknown;
}): Promise<Buffer> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 48;
  let y = 64;

  const proposalTitle = String(proposal.title || `Proposta ${proposal.id}`);
  const clientName = String(proposal.clientName || "Cliente nao informado");
  const proposalCode = String(proposal.code || proposal.id);
  const status = String(proposal.status || "N/A");
  const totalValue = toNumber(
    proposal.totalValue ?? proposal.total ?? proposal.value,
  );
  const validUntil = toDate(proposal.validUntil);
  const notes = String(proposal.customNotes || "").trim();

  doc.setFontSize(20);
  doc.text("Proposta Comercial", marginX, y);
  y += 34;

  doc.setFontSize(12);
  doc.text(`Titulo: ${proposalTitle}`, marginX, y);
  y += 22;
  doc.text(`Cliente: ${clientName}`, marginX, y);
  y += 22;
  doc.text(`Codigo: ${proposalCode}`, marginX, y);
  y += 22;
  doc.text(`Status: ${status}`, marginX, y);
  y += 22;
  doc.text(`Valor total: ${formatCurrency(totalValue)}`, marginX, y);
  y += 22;
  doc.text(
    `Validade: ${validUntil ? validUntil.toLocaleDateString("pt-BR") : "Nao informado"}`,
    marginX,
    y,
  );
  y += 30;
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, marginX, y);
  y += 30;

  if (notes) {
    doc.setFontSize(11);
    doc.text("Observacoes:", marginX, y);
    y += 18;
    const wrappedNotes = doc.splitTextToSize(notes, 500);
    doc.text(wrappedNotes, marginX, y);
  }

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

async function generateProposalPdfBuffer(proposal: {
  id: string;
  [key: string]: unknown;
}): Promise<Buffer> {
  const configuredRenderer = String(process.env.PDF_RENDERER || "jspdf")
    .trim()
    .toLowerCase();

  if (configuredRenderer === "puppeteer") {
    console.warn(
      "[WhatsApp] PDF_RENDERER=puppeteer is not implemented yet. Falling back to jspdf.",
    );
  }

  return generateSimpleProposalPdfBuffer(proposal);
}

async function getOrGenerateProposalPdf(
  tenantId: string,
  proposalId: string,
): Promise<{ pdfUrl: string; pdfPath: string }> {
  const proposal = await getProposalByIdForTenant(tenantId, proposalId);
  if (!proposal) {
    throw new Error("PROPOSAL_NOT_FOUND");
  }

  const bucket = getStorage().bucket();
  const standardPath = buildProposalPdfStoragePath(tenantId, proposal.id);
  const attachments = Array.isArray(proposal.attachments)
    ? proposal.attachments
    : [];
  const attachmentPdfUrl = attachments
    .map((attachment) => {
      const typedAttachment = attachment as {
        name?: unknown;
        type?: unknown;
        url?: unknown;
      };
      const name = String(typedAttachment.name || "").toLowerCase();
      const type = String(typedAttachment.type || "").toLowerCase();
      if (type === "pdf" || name.endsWith(".pdf")) {
        return String(typedAttachment.url || "").trim();
      }
      return "";
    })
    .find((url) => Boolean(url));
  const existingPdfUrl =
    typeof proposal.pdfUrl === "string" ? proposal.pdfUrl.trim() : "";
  const existingPdfPath =
    typeof proposal.pdfPath === "string" ? proposal.pdfPath.trim() : "";
  const preferredExistingUrl = existingPdfUrl || attachmentPdfUrl || "";
  const proposalRef = db.collection("proposals").doc(proposal.id);

  if (preferredExistingUrl && (await isUrlAccessible(preferredExistingUrl))) {
    const resolvedPath =
      existingPdfPath ||
      parseStoragePathFromUrl(preferredExistingUrl) ||
      standardPath;
    await proposalRef.update({
      pdfPath: resolvedPath,
      pdfUrl: preferredExistingUrl,
    });
    console.log("[WhatsApp] PDF found existing", {
      proposalId: proposal.id,
      tenantId,
      pdfPath: resolvedPath,
    });
    return { pdfUrl: preferredExistingUrl, pdfPath: resolvedPath };
  }

  const pathCandidates = Array.from(
    new Set(
      [
        existingPdfPath,
        parseStoragePathFromUrl(existingPdfUrl),
        parseStoragePathFromUrl(attachmentPdfUrl || ""),
        standardPath,
      ].filter((value): value is string => Boolean(value)),
    ),
  );

  for (const pathCandidate of pathCandidates) {
    const file = bucket.file(pathCandidate);
    const [exists] = await file.exists();
    if (!exists) continue;

    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + PDF_URL_VALIDITY_MS,
    });

    await proposalRef.update({
      pdfPath: pathCandidate,
      pdfUrl: signedUrl,
    });

    console.log("[WhatsApp] PDF found existing", {
      proposalId: proposal.id,
      tenantId,
      pdfPath: pathCandidate,
    });
    return { pdfUrl: signedUrl, pdfPath: pathCandidate };
  }

  const lockOwner = `wa-${proposal.id}-${Date.now()}`;
  const lockAcquired = await db.runTransaction(async (transaction) => {
    const proposalSnap = await transaction.get(proposalRef);
    if (!proposalSnap.exists) {
      throw new Error("PROPOSAL_NOT_FOUND");
    }

    const data = proposalSnap.data() as
      | {
          pdfGenerationLock?: { lockedAt?: unknown; lockedBy?: unknown };
        }
      | undefined;
    const lock = data?.pdfGenerationLock;
    const lockDate = toDate(lock?.lockedAt);
    const lockIsStale =
      !lockDate ||
      Date.now() - lockDate.getTime() > PDF_GENERATION_LOCK_TIMEOUT_MS;
    const isLockedByOther =
      !!lock &&
      !lockIsStale &&
      String(lock.lockedBy || "").trim() &&
      String(lock.lockedBy || "").trim() !== lockOwner;

    if (isLockedByOther) {
      return false;
    }

    transaction.update(proposalRef, {
      pdfGenerationLock: {
        lockedAt: FieldValue.serverTimestamp(),
        lockedBy: lockOwner,
      },
    });
    return true;
  });

  if (!lockAcquired) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const refreshed = await proposalRef.get();
      const refreshedData = refreshed.data() as
        | { pdfPath?: unknown; pdfUrl?: unknown }
        | undefined;
      const refreshedPath = String(refreshedData?.pdfPath || "").trim();
      const refreshedUrl = String(refreshedData?.pdfUrl || "").trim();

      if (refreshedPath) {
        const waitingFile = bucket.file(refreshedPath);
        const [exists] = await waitingFile.exists();
        if (exists) {
          const [signedUrl] = await waitingFile.getSignedUrl({
            action: "read",
            expires: Date.now() + PDF_URL_VALIDITY_MS,
          });
          await proposalRef.update({ pdfUrl: signedUrl });
          console.log("[WhatsApp] PDF found existing", {
            proposalId: proposal.id,
            tenantId,
            pdfPath: refreshedPath,
          });
          return { pdfUrl: signedUrl, pdfPath: refreshedPath };
        }
      }

      if (refreshedUrl && (await isUrlAccessible(refreshedUrl))) {
        const resolvedPath =
          parseStoragePathFromUrl(refreshedUrl) || standardPath;
        return { pdfUrl: refreshedUrl, pdfPath: resolvedPath };
      }
    }

    throw new Error("PDF_GENERATION_IN_PROGRESS");
  }

  const pdfPath = standardPath;
  const file = bucket.file(pdfPath);

  try {
    const generatedPdfBuffer = await generateProposalPdfBuffer(proposal);

    await file.save(generatedPdfBuffer, {
      contentType: "application/pdf",
      metadata: {
        cacheControl: "private, max-age=3600",
      },
    });

    const [pdfUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + PDF_URL_VALIDITY_MS,
    });

    await proposalRef.update({
      pdfPath,
      pdfUrl,
      pdfGeneratedAt: FieldValue.serverTimestamp(),
      pdfGenerationLock: FieldValue.delete(),
    });

    console.log("[WhatsApp] PDF generated", {
      proposalId: proposal.id,
      tenantId,
      pdfPath,
    });

    return { pdfUrl, pdfPath };
  } catch (error) {
    await proposalRef.update({
      pdfGenerationLock: FieldValue.delete(),
    });
    throw error;
  }
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
      const fallback = await collectionRef
        .where("tenantId", "==", tenantId)
        .get();
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

async function queryWalletsForTenant(
  firestore: FirebaseFirestore.Firestore,
  tenantId: string,
): Promise<{ totalBalance: number; count: number }> {
  const walletsRef = firestore.collection("wallets");

  const runQuery = async (field: "tenantId" | "companyId") => {
    try {
      return await walletsRef.where(field, "==", tenantId).get();
    } catch (error) {
      console.warn(`[WhatsApp] wallets query failed (${field})`, error);
      return null;
    }
  };

  const tenantSnap = await runQuery("tenantId");
  const companySnap =
    tenantSnap && !tenantSnap.empty ? null : await runQuery("companyId");
  const snap = tenantSnap && !tenantSnap.empty ? tenantSnap : companySnap;

  if (!snap || snap.empty) {
    console.log("[WhatsApp] wallets found", {
      tenantId,
      count: 0,
      totalBalance: 0,
    });
    return { totalBalance: 0, count: 0 };
  }

  const allDocs = snap.docs;
  const activeDocs = allDocs.filter((doc) => {
    const data = doc.data() as any;
    return !data.status || data.status === "active";
  });
  const docsToSum = activeDocs.length > 0 ? activeDocs : allDocs;

  const totalBalance = docsToSum.reduce((acc, doc) => {
    const data = doc.data() as any;
    return acc + toNumber(data.balance ?? data.amount);
  }, 0);

  console.log("[WhatsApp] wallets found", {
    tenantId,
    count: docsToSum.length,
    totalBalance,
  });

  return { totalBalance, count: docsToSum.length };
}

async function getWalletSummary(
  tenantId: string,
): Promise<{ totalBalance: number }> {
  try {
    const result = await queryWalletsForTenant(db, tenantId);
    return { totalBalance: result.totalBalance };
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

  await ref.set(data, { merge: true });

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

async function incrementUsage(
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
    const proposals = await queryProposalsForTenant(db, tenantId, 10);

    if (proposals.length === 0) {
      await sendWhatsAppMessage(to, "Nenhuma proposta encontrada.");
      await updateSession(to, { lastAction: "idle", proposalsShown: [] });
      return;
    }

    let msg = "📄 *Propostas recentes:*\n\n";
    const proposalsShown: { id: string; index: number }[] = [];

    proposals.forEach((p, index) => {
      const value = p.totalValue ? formatCurrency(p.totalValue) : "R$ 0,00";
      const displayIndex = index + 1;
      const title = String(p.title || "Proposta");
      const client = String(p.clientName || "Sem cliente");

      proposalsShown.push({ id: p.id, index: displayIndex });
      msg += `${displayIndex}️⃣ *#${p.id.slice(0, 5)}...* – ${title} – ${client} – ${value}\n`;
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
    const proposal = await getProposalByIdForTenant(
      tenantId,
      proposalIdOrFragment,
    );

    if (!proposal) {
      await sendWhatsAppMessage(to, "Não encontrei a proposta.");
      await updateSession(to, { lastAction: "idle", proposalsShown: [] });
      return;
    }

    const { pdfUrl, pdfPath } = await getOrGenerateProposalPdf(
      tenantId,
      proposal.id,
    );
    const caption = `Segue o PDF da proposta ${String(proposal.title || proposal.id)}`;
    const supportsDocumentSend =
      process.env.WHATSAPP_SUPPORTS_DOCUMENT !== "false";

    if (supportsDocumentSend) {
      try {
        await sendWhatsAppPdf(to, pdfUrl, caption);
      } catch (documentError) {
        console.warn("[WhatsApp] Document send failed, using link fallback", {
          proposalId: proposal.id,
          tenantId,
          pdfPath,
          error:
            documentError instanceof Error
              ? documentError.message
              : String(documentError),
        });
        await sendWhatsAppMessage(to, `${caption}\n${pdfUrl}`);
      }
    } else {
      await sendWhatsAppMessage(to, `${caption}\n${pdfUrl}`);
    }

    await logAction(to, userId, "send_pdf_success", {
      proposalId: proposal.id,
      pdfPath,
    });

    await updateSession(to, { lastAction: "idle", proposalsShown: [] });
  } catch (error) {
    console.error("[WhatsApp] Error in handleSendPdf:", error);
    if (
      error instanceof Error &&
      error.message === "PDF_GENERATION_IN_PROGRESS"
    ) {
      await sendWhatsAppMessage(
        to,
        "O PDF está sendo gerado por outra solicitação. Tente novamente em alguns segundos.",
      );
    } else {
      await sendWhatsAppMessage(to, "Não encontrei a proposta.");
    }
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

// ============================================
// ROUTE CONTROLLERS
// ============================================

export const verifyChallenge = async (req: Request, res: Response) => {
  const mode = req.query["hub.mode"] as string;
  const token = req.query["hub.verify_token"] as string;
  const challenge = req.query["hub.challenge"] as string;

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!VERIFY_TOKEN) {
    console.error("WHATSAPP_VERIFY_TOKEN is not defined");
    return res.status(500).send("Internal Server Error");
  }

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("WEBHOOK_VERIFIED");
      return res.status(200).send(challenge);
    } else {
      return res.status(403).send("Forbidden");
    }
  }

  return res.status(200).send("Hello WhatsApp");
};

export const handleWebhook = async (req: Request, res: Response) => {
  try {
    const APP_SECRET = process.env.WHATSAPP_APP_SECRET;

    if (!APP_SECRET) {
      console.error("WHATSAPP_APP_SECRET is not defined");
      return res.status(500).send("Server Configuration Error");
    }

    const signature = req.headers["x-hub-signature-256"] as string;

    // We expect express middleware to populate req.rawBody
    const rawBodyBuffer = (req as any).rawBody;
    const rawBodyString = rawBodyBuffer
      ? rawBodyBuffer.toString("utf8")
      : JSON.stringify(req.body);

    if (
      !verifyWhatsAppSignature(
        rawBodyBuffer || rawBodyString,
        signature,
        APP_SECRET,
      )
    ) {
      console.log("Invalid WhatsApp signature");
      return res.status(401).send("Invalid signature");
    }

    const body = req.body as WebhookPayload;

    if (body.object === "whatsapp_business_account") {
      if (
        body.entry &&
        body.entry[0].changes &&
        body.entry[0].changes[0].value.messages &&
        body.entry[0].changes[0].value.messages[0]
      ) {
        const message = body.entry[0].changes[0].value.messages[0];
        const from = message.from;
        const phone = normalizePhoneNumber(from);
        const text = message.text?.body || "";

        const isRateLimitOk = await checkRateLimit(from);
        if (!isRateLimitOk) {
          await sendWhatsAppMessage(
            from,
            "⏳ Limite temporário de uso atingido. Tente novamente em alguns minutos.",
          );
          return res.status(200).send("OK");
        }

        if (!phone) {
          await sendWhatsAppMessage(from, "Seu número não está vinculado");
          return res.status(200).send("OK");
        }

        const phoneIndexSnap = await db
          .collection("phoneNumberIndex")
          .doc(phone)
          .get();
        if (!phoneIndexSnap.exists) {
          await sendWhatsAppMessage(from, "Seu número não está vinculado");
          return res.status(200).send("OK");
        }

        const phoneIndexData = phoneIndexSnap.data() as
          | { userId?: string; tenantId?: string }
          | undefined;
        const indexedUserId = String(phoneIndexData?.userId || "").trim();
        const indexedTenantId = String(phoneIndexData?.tenantId || "").trim();

        if (!indexedUserId || !indexedTenantId) {
          await sendWhatsAppMessage(from, "Seu número não está vinculado");
          return res.status(200).send("OK");
        }

        const userDoc = await db.collection("users").doc(indexedUserId).get();
        if (!userDoc.exists) {
          await sendWhatsAppMessage(from, "Seu número não está vinculado");
          return res.status(200).send("OK");
        }

        const user = { id: userDoc.id, ...userDoc.data() } as any;
        if (user.status === "inactive") {
          await sendWhatsAppMessage(from, "Seu número não está vinculado");
          return res.status(200).send("OK");
        }

        if (user.tenantId && user.tenantId !== indexedTenantId) {
          console.warn("[WhatsApp] phone index tenant mismatch", {
            phone,
            userId: user.id,
            userTenantId: user.tenantId,
            indexTenantId: indexedTenantId,
          });
          await sendWhatsAppMessage(from, "Seu número não está vinculado");
          return res.status(200).send("OK");
        }

        const tenantId = indexedTenantId;
        console.log("[WhatsApp] resolved phone", {
          phone,
          userId: user.id,
          tenantId,
        });

        const tenantRef = db.collection("tenants").doc(tenantId);
        const tenantSnap = await tenantRef.get();

        if (!tenantSnap.exists) {
          return res.status(200).send("OK");
        }

        const tenantData = tenantSnap.data()!;

        if (tenantData.whatsappEnabled !== true) {
          await sendWhatsAppMessage(
            from,
            "🚫 O WhatsApp não está habilitado para sua empresa. Entre em contato com o administrador.",
          );
          return res.status(200).send("OK");
        }

        const limit = tenantData.whatsappMonthlyLimit || MONTHLY_LIMIT;
        const allowOverage = tenantData.whatsappAllowOverage === true;

        const isUsageOk = await checkUsage(tenantId, limit, allowOverage);

        if (!isUsageOk) {
          await sendWhatsAppMessage(
            from,
            "⚠️ O limite mensal de uso do WhatsApp foi atingido. Entre em contato com o administrador.",
          );
          return res.status(200).send("OK");
        }

        const normalizedText = text.toLowerCase().trim();

        const session = await getOrCreateSession(from, user.id);

        let actionProcessed = false;

        if (
          ["ver propostas", "minhas propostas", "listar propostas"].some((t) =>
            normalizedText.includes(t),
          )
        ) {
          await handleListProposals(from, tenantId, user.id);
          actionProcessed = true;
        } else if (/^#?(\d+)$/.test(normalizedText)) {
          const inputId = normalizedText.replace("#", "").trim();

          let handled = false;
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
            await handleSendPdf(from, tenantId, inputId, user.id);
          }
          actionProcessed = true;
        } else if (
          ["financeiro de hoje", "resumo de hoje", "movimento do dia"].some(
            (t) => normalizedText.includes(t),
          )
        ) {
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
        } else if (
          ["saldo", "saldo atual", "quanto tenho", "caixa"].some((t) =>
            normalizedText.includes(t),
          )
        ) {
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
        } else {
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
            await updateSession(from, {
              lastAction: "idle",
              proposalsShown: [],
            });
          }
          actionProcessed = true;
        }

        if (actionProcessed) {
          await incrementUsage(tenantId, limit, from);
        }
      }
    }

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Error processing webhook:", error);
    return res.status(500).send("Internal Server Error");
  }
};
