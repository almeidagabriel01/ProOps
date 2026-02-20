import crypto from "crypto";
import { Timestamp } from "firebase-admin/firestore";
import { WhatsAppStatus } from "./whatsapp.types";

export function verifyWhatsAppSignature(
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

export function formatOutboundNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("55")) {
    return digits.slice(0, 4) + "9" + digits.slice(4);
  }
  return digits;
}

export function normalizeEnvValue(value: string | undefined): string {
  if (!value) return "";
  return value
    .trim()
    .replace(/^['"]+|['"]+$/g, "")
    .trim();
}

export function normalizeEnvAssignment(value: string): string {
  const assignmentMatch = value.match(/^[A-Z0-9_]+\s*=\s*(.+)$/i);
  if (!assignmentMatch) return value;
  return assignmentMatch[1].trim();
}

export function normalizeWhatsAppAccessToken(
  rawValue: string | undefined,
): string {
  if (!rawValue) return "";

  let normalized = normalizeEnvAssignment(normalizeEnvValue(rawValue));

  if (normalized.startsWith("{") && normalized.endsWith("}")) {
    try {
      const parsed = JSON.parse(normalized) as {
        access_token?: unknown;
        token?: unknown;
        WHATSAPP_ACCESS_TOKEN?: unknown;
      };
      const jsonToken =
        parsed.access_token ?? parsed.token ?? parsed.WHATSAPP_ACCESS_TOKEN;
      if (typeof jsonToken === "string") {
        normalized = jsonToken;
      }
    } catch {
      // Keep original normalized value if JSON parse fails
    }
  }

  normalized = normalizeEnvValue(normalized)
    .replace(/^Bearer\s+/i, "")
    .replace(/\s+/g, "");

  return normalized;
}

export function getTokenDiagnostics(
  rawValue: string | undefined,
  token: string,
) {
  const raw = rawValue || "";
  return {
    rawLength: raw.length,
    normalizedLength: token.length,
    hasWhitespaceInRaw: /\s/.test(raw),
    hadBearerPrefixInRaw: /^\s*Bearer\s+/i.test(raw),
    lookedLikeJsonInRaw: raw.trim().startsWith("{"),
    tokenFingerprint: token
      ? crypto.createHash("sha256").update(token).digest("hex").slice(0, 12)
      : "",
  };
}

export function logIncomingStatuses(statuses: WhatsAppStatus[]) {
  for (const statusItem of statuses) {
    const payload = {
      messageId: statusItem.id,
      status: statusItem.status,
      recipientId: statusItem.recipient_id,
      timestamp: statusItem.timestamp,
      errors: statusItem.errors,
    };

    if (statusItem.status === "failed") {
      console.error("[WhatsApp] Delivery failed", payload);
    } else {
      console.log("[WhatsApp] Delivery update", payload);
    }
  }
}

export function getWhatsAppApiConfig(): {
  token: string;
  phoneNumberId: string;
  tokenDiagnostics: ReturnType<typeof getTokenDiagnostics>;
} | null {
  const rawToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const token = normalizeWhatsAppAccessToken(rawToken);
  const phoneNumberId = normalizeEnvAssignment(
    normalizeEnvValue(process.env.WHATSAPP_PHONE_NUMBER_ID),
  ).replace(/\s+/g, "");
  const tokenDiagnostics = getTokenDiagnostics(rawToken, token);

  if (!token || !phoneNumberId) {
    console.error(
      "[WhatsApp] Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID config",
    );
    return null;
  }

  if (!/^\d+$/.test(phoneNumberId)) {
    console.error(
      "[WhatsApp] Invalid WHATSAPP_PHONE_NUMBER_ID format (expected numeric string)",
    );
    return null;
  }

  return { token, phoneNumberId, tokenDiagnostics };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function normalizePhoneNumber(value: unknown): string {
  if (!value) return "";
  let digits = String(value).replace(/\D/g, "");

  if (digits.length === 10 || digits.length === 11) {
    digits = "55" + digits;
  }

  if (digits.length === 12 && digits.startsWith("55")) {
    digits = `${digits.substring(0, 4)}9${digits.substring(4)}`;
  }

  return digits;
}

export function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function toDate(value: unknown): Date | null {
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

export function normalizeTransactionType(
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

export function buildProposalPdfStoragePath(
  tenantId: string,
  proposalId: string,
): string {
  return `proposals/${tenantId}/${proposalId}/proposal.pdf`;
}

export function parseStoragePathFromUrl(value: string): string | null {
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

export async function isUrlAccessible(url: string): Promise<boolean> {
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

export function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
