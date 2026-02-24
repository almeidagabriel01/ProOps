import { lookup } from "node:dns/promises";
import net from "node:net";

const LOCAL_HOSTNAMES = new Set(["localhost", "localhost.localdomain"]);
const DEFAULT_MAX_URL_LENGTH = 2048;

export interface OutboundUrlValidationOptions {
  allowedHosts?: string[];
  allowHttp?: boolean;
  allowLocalAddresses?: boolean;
  maxUrlLength?: number;
}

export type OutboundUrlValidationResult =
  | {
      ok: true;
      url: URL;
      normalizedUrl: string;
      resolvedAddresses: string[];
    }
  | {
      ok: false;
      statusCode: number;
      reason: string;
    };

function normalizeHostname(value: string): string {
  return String(value || "").trim().toLowerCase().replace(/\.$/, "");
}

export function parseCommaSeparatedHosts(rawValue: string | undefined): string[] {
  if (!rawValue) return [];

  return Array.from(
    new Set(
      rawValue
        .split(",")
        .map((value) => normalizeHostname(value))
        .filter(Boolean),
    ),
  );
}

function hostMatches(allowedHost: string, hostname: string): boolean {
  return hostname === allowedHost || hostname.endsWith(`.${allowedHost}`);
}

function isLocalHostname(hostname: string): boolean {
  if (LOCAL_HOSTNAMES.has(hostname)) return true;
  if (hostname.endsWith(".local")) return true;
  if (hostname.endsWith(".internal")) return true;
  return false;
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return true;
  }

  const [a, b] = parts;

  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;

  return false;
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();

  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fe80:")) return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("2001:db8")) return true;

  const ipv4Mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (ipv4Mapped) {
    return isPrivateIpv4(ipv4Mapped[1]);
  }

  return false;
}

function isPrivateIpAddress(address: string): boolean {
  const ipVersion = net.isIP(address);
  if (ipVersion === 4) return isPrivateIpv4(address);
  if (ipVersion === 6) return isPrivateIpv6(address);
  return true;
}

async function resolveHostAddresses(hostname: string): Promise<string[]> {
  if (net.isIP(hostname)) {
    return [hostname];
  }

  const resolved = await lookup(hostname, { all: true, verbatim: true });
  return Array.from(
    new Set(
      resolved
        .map((entry) => entry.address)
        .filter((address): address is string => Boolean(address)),
    ),
  );
}

export async function validateOutboundUrl(
  rawUrl: string,
  options: OutboundUrlValidationOptions = {},
): Promise<OutboundUrlValidationResult> {
  const trimmedUrl = String(rawUrl || "").trim();
  const maxUrlLength = options.maxUrlLength || DEFAULT_MAX_URL_LENGTH;
  const allowHttp = options.allowHttp === true;
  const allowLocalAddresses = options.allowLocalAddresses === true;
  const allowedHosts = (options.allowedHosts || [])
    .map((host) => normalizeHostname(host))
    .filter(Boolean);

  if (!trimmedUrl) {
    return { ok: false, statusCode: 400, reason: "Missing URL parameter" };
  }

  if (trimmedUrl.length > maxUrlLength) {
    return { ok: false, statusCode: 400, reason: "URL is too long" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmedUrl);
  } catch {
    return { ok: false, statusCode: 400, reason: "Invalid URL format" };
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "https:" && protocol !== "http:") {
    return { ok: false, statusCode: 400, reason: "Only HTTP(S) URLs are allowed" };
  }

  if (protocol === "http:" && !allowHttp) {
    return { ok: false, statusCode: 400, reason: "HTTP URLs are not allowed" };
  }

  if (parsed.username || parsed.password) {
    return {
      ok: false,
      statusCode: 400,
      reason: "Credentials in URL are not allowed",
    };
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (!hostname) {
    return { ok: false, statusCode: 400, reason: "URL hostname is required" };
  }

  if (allowedHosts.length > 0) {
    const matched = allowedHosts.some((allowedHost) =>
      hostMatches(allowedHost, hostname),
    );
    if (!matched) {
      return {
        ok: false,
        statusCode: 403,
        reason: "Host is not allowed by proxy policy",
      };
    }
  }

  if (!allowLocalAddresses && isLocalHostname(hostname)) {
    return {
      ok: false,
      statusCode: 403,
      reason: "Local hostnames are not allowed",
    };
  }

  let resolvedAddresses: string[];
  try {
    resolvedAddresses = await resolveHostAddresses(hostname);
  } catch {
    return {
      ok: false,
      statusCode: 400,
      reason: "Unable to resolve URL hostname",
    };
  }

  if (resolvedAddresses.length === 0) {
    return {
      ok: false,
      statusCode: 400,
      reason: "Hostname has no resolvable IP address",
    };
  }

  if (
    !allowLocalAddresses &&
    resolvedAddresses.some((address) => isPrivateIpAddress(address))
  ) {
    return {
      ok: false,
      statusCode: 403,
      reason: "Private or reserved network addresses are blocked",
    };
  }

  return {
    ok: true,
    url: parsed,
    normalizedUrl: parsed.toString(),
    resolvedAddresses,
  };
}
