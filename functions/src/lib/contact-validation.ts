import { resolve4, resolve6, resolveMx } from "node:dns/promises";

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const VALID_BRAZIL_DDD = new Set([
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "21",
  "22",
  "24",
  "27",
  "28",
  "31",
  "32",
  "33",
  "34",
  "35",
  "37",
  "38",
  "41",
  "42",
  "43",
  "44",
  "45",
  "46",
  "47",
  "48",
  "49",
  "51",
  "53",
  "54",
  "55",
  "61",
  "62",
  "63",
  "64",
  "65",
  "66",
  "67",
  "68",
  "69",
  "71",
  "73",
  "74",
  "75",
  "77",
  "79",
  "81",
  "82",
  "83",
  "84",
  "85",
  "86",
  "87",
  "88",
  "89",
  "91",
  "92",
  "93",
  "94",
  "95",
  "96",
  "97",
  "98",
  "99",
]);

const DOMAIN_CACHE_TTL_MS = 10 * 60 * 1000;
const domainValidationCache = new Map<
  string,
  { valid: boolean; expiresAt: number }
>();

function withTimeout<T>(promise: Promise<T>, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("VALIDATION_TIMEOUT"));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timeout);
        reject(err);
      });
  });
}

function hasRepeatedDigits(value: string): boolean {
  return /^(\d)\1+$/.test(value);
}

export function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

export function isValidEmailSyntax(value: unknown): boolean {
  const email = normalizeEmail(value);
  if (!email || email.length > 254) return false;
  if (!EMAIL_REGEX.test(email)) return false;

  const [, domain = ""] = email.split("@");
  const labels = domain.split(".");
  if (labels.some((label) => label.length === 0 || label.length > 63)) {
    return false;
  }

  const tld = labels[labels.length - 1] || "";
  return tld.length >= 2;
}

export async function hasResolvableEmailDomain(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  const domain = normalized.split("@")[1] || "";
  if (!domain) return false;

  const cached = domainValidationCache.get(domain);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.valid;
  }

  const checks = [
    withTimeout(resolveMx(domain), 2500).then((mxRecords) =>
      Array.isArray(mxRecords) && mxRecords.length > 0,
    ),
    withTimeout(resolve4(domain), 2500).then(
      (records) => Array.isArray(records) && records.length > 0,
    ),
    withTimeout(resolve6(domain), 2500).then(
      (records) => Array.isArray(records) && records.length > 0,
    ),
  ];

  const settled = await Promise.allSettled(checks);
  const valid = settled.some(
    (entry) => entry.status === "fulfilled" && entry.value === true,
  );

  domainValidationCache.set(domain, {
    valid,
    expiresAt: now + DOMAIN_CACHE_TTL_MS,
  });

  return valid;
}

export async function validateEmailForSignup(value: unknown): Promise<{
  valid: boolean;
  normalizedEmail: string;
  reason?: string;
}> {
  const normalizedEmail = normalizeEmail(value);

  if (!isValidEmailSyntax(normalizedEmail)) {
    return {
      valid: false,
      normalizedEmail,
      reason: "Formato de email inválido.",
    };
  }

  try {
    const hasDomain = await hasResolvableEmailDomain(normalizedEmail);
    if (!hasDomain) {
      return {
        valid: false,
        normalizedEmail,
        reason: "Domínio de email inexistente ou sem DNS válido.",
      };
    }
  } catch {
    return {
      valid: false,
      normalizedEmail,
      reason: "Não foi possível validar o domínio do email.",
    };
  }

  return { valid: true, normalizedEmail };
}

export function normalizeBrazilPhoneNumber(value: unknown): string {
  if (!value) return "";

  let digits = String(value).replace(/\D/g, "");
  if (!digits) return "";

  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }

  if (digits.length === 12 && digits.startsWith("55")) {
    const ddd = digits.substring(2, 4);
    const subscriber = digits.substring(4);
    if (!subscriber.startsWith("9") && subscriber.length === 8) {
      digits = `55${ddd}9${subscriber}`;
    }
  }

  return digits;
}

export function validateBrazilMobilePhone(value: unknown): {
  valid: boolean;
  normalizedPhone: string;
  reason?: string;
} {
  const normalizedPhone = normalizeBrazilPhoneNumber(value);

  if (!normalizedPhone) {
    return {
      valid: false,
      normalizedPhone,
      reason: "Telefone vazio.",
    };
  }

  if (!normalizedPhone.startsWith("55") || normalizedPhone.length !== 13) {
    return {
      valid: false,
      normalizedPhone,
      reason: "Telefone deve estar no padrão brasileiro com DDI 55.",
    };
  }

  const ddd = normalizedPhone.substring(2, 4);
  const mobilePrefix = normalizedPhone.substring(4, 5);
  const subscriber = normalizedPhone.substring(4);

  if (!VALID_BRAZIL_DDD.has(ddd)) {
    return {
      valid: false,
      normalizedPhone,
      reason: "DDD inválido.",
    };
  }

  if (mobilePrefix !== "9") {
    return {
      valid: false,
      normalizedPhone,
      reason: "Celular inválido: o número deve começar com 9 após o DDD (ex: (11) 9XXXX-XXXX).",
    };
  }

  if (hasRepeatedDigits(subscriber)) {
    return {
      valid: false,
      normalizedPhone,
      reason: "Número de telefone inválido.",
    };
  }

  if (
    subscriber === "900000000" ||
    subscriber === "999999999" ||
    subscriber === "912345678"
  ) {
    return {
      valid: false,
      normalizedPhone,
      reason: "Número de telefone inválido.",
    };
  }

  return {
    valid: true,
    normalizedPhone,
  };
}
