const DEFAULT_LOCAL_APP_URL = "http://localhost:3000";
const DEFAULT_PREVIEW_APP_URL =
  "https://template-erp-git-develop-gestao-2562s-projects.vercel.app";
const DEFAULT_PRODUCTION_APP_URL = "https://www.proops.com.br";
const PRODUCTION_PROJECT_ID = "erp-softcode-prod";

function normalizeUrl(value: string): string {
  return String(value || "").trim().replace(/\/+$/, "");
}

function getProjectIdFromFirebaseConfig(): string {
  const rawConfig = String(process.env.FIREBASE_CONFIG || "").trim();
  if (!rawConfig) return "";

  try {
    const parsed = JSON.parse(rawConfig) as { projectId?: string };
    return String(parsed.projectId || "").trim();
  } catch {
    return "";
  }
}

export function getCurrentProjectId(): string {
  return (
    String(process.env.GCLOUD_PROJECT || "").trim() ||
    String(process.env.GCP_PROJECT || "").trim() ||
    getProjectIdFromFirebaseConfig()
  );
}

export function isFunctionsEmulatorRuntime(): boolean {
  return String(process.env.FUNCTIONS_EMULATOR || "")
    .trim()
    .toLowerCase() === "true";
}

function getConfiguredAppUrl(): string {
  const configured = [
    process.env.PDF_APP_URL,
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ]
    .map((value) => normalizeUrl(String(value || "")))
    .find(Boolean);

  return configured || "";
}

function getDefaultAppUrlForProject(projectId: string): string {
  if (projectId === PRODUCTION_PROJECT_ID) {
    return DEFAULT_PRODUCTION_APP_URL;
  }

  return DEFAULT_PREVIEW_APP_URL;
}

export function resolveFrontendAppOrigin(): string {
  if (isFunctionsEmulatorRuntime()) {
    return normalizeUrl(process.env.LOCAL_APP_URL || DEFAULT_LOCAL_APP_URL);
  }

  const configured = getConfiguredAppUrl();
  if (configured) {
    return configured;
  }

  return getDefaultAppUrlForProject(getCurrentProjectId());
}

export function resolveFrontendAppUrl(): string {
  return `${resolveFrontendAppOrigin()}/`;
}
