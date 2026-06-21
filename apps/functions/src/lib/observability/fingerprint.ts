import { createHash } from "node:crypto";

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const HEX_RE = /\b[0-9a-f]{16,}\b/gi;
const NUM_RE = /\b\d{2,}\b/g;

export function normalizeErrorMessage(message: string): string {
  return (message || "")
    .replace(UUID_RE, "<id>")
    .replace(EMAIL_RE, "<email>")
    .replace(HEX_RE, "<id>")
    .replace(NUM_RE, "<n>")
    .replace(/\s+/g, " ")
    .trim();
}

export function firstStackFrame(stack: string | null): string {
  if (!stack) return "";
  const line = stack.split("\n").map((l) => l.trim()).find((l) => l.startsWith("at "));
  return line || "";
}

export function computeFingerprint(input: {
  errorType: string;
  normalizedMessage: string;
  route: string | null;
  stackTopFrame: string;
}): string {
  const basis = [
    input.errorType || "Error",
    input.normalizedMessage || "",
    input.route || "",
    input.stackTopFrame || "",
  ].join("|");
  return createHash("sha1").update(basis).digest("hex");
}
