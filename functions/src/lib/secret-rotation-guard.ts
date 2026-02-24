import { createHash } from "node:crypto";

type GuardIssue = {
  env: string;
  fingerprint: string;
};

type GuardOptions = {
  source: string;
};

const COMPROMISED_FINGERPRINTS: Record<string, Set<string>> = {
  STRIPE_SECRET_KEY: new Set([
    "223ffc3e56073021bbbc4bd1b2141db9a1ec03b342e5eaa432b0b83635ed8a66",
    "60bc9fccecf377739482df1a5fd80325121a1744e8b06bc4cf5bc294a2434a3f",
  ]),
  STRIPE_WEBHOOK_SECRET: new Set([
    "75fadf94491e4d3095e1947a43cdf0dcda3e54e34821e6f9420d7a31adcd710d",
    "1dbad1a7af16d02d86cc078ae6f046697e10ade2af8ce2803151303a45b4d703",
  ]),
  WHATSAPP_VERIFY_TOKEN: new Set([
    "2049963d279a7dccebafb864a77bcb8b73d9a15aeb37f5c69195e0335efbb3ff",
  ]),
  WHATSAPP_APP_SECRET: new Set([
    "f5038b402bfc0f4997b07372bfd0d2cd76fc7ae518f27838eb8eccdc2d326b38",
  ]),
  WHATSAPP_ACCESS_TOKEN: new Set([
    "94c2905768e37491b094e19285ccdcb22aa5214fcf47589d3a9114b44a7c7cd3",
  ]),
};

let hasRun = false;

function toSha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isProductionRuntime(): boolean {
  return String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
}

function shouldBlockCompromisedSecrets(): boolean {
  const configured = String(
    process.env.SECURITY_BLOCK_COMPROMISED_SECRETS ||
      (isProductionRuntime() ? "false" : "false"),
  )
    .trim()
    .toLowerCase();

  return configured === "true";
}

function findCompromisedIssues(): GuardIssue[] {
  const issues: GuardIssue[] = [];

  Object.entries(COMPROMISED_FINGERPRINTS).forEach(([envName, fingerprints]) => {
    const value = String(process.env[envName] || "").trim();
    if (!value) return;
    const fingerprint = toSha256(value);
    if (fingerprints.has(fingerprint)) {
      issues.push({ env: envName, fingerprint });
    }
  });

  return issues;
}

export function runSecretRotationGuard(options: GuardOptions): void {
  if (hasRun) return;
  hasRun = true;

  const issues = findCompromisedIssues();
  if (issues.length === 0) return;

  const summary = issues.map((item) => item.env).join(", ");
  const message =
    `[SECURITY][${options.source}] Compromised secrets detected: ${summary}. ` +
    "Rotate immediately in providers (Stripe/Meta/Firebase) and update runtime envs.";

  if (shouldBlockCompromisedSecrets()) {
    throw new Error(message);
  }

  console.error(message);
}
