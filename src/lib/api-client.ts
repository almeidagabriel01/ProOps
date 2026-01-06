import { auth } from "./firebase";

// API URLs per Firebase Project
const API_URLS: Record<string, string> = {
  "erp-softcode": "https://api-2lumykmdwa-rj.a.run.app", // DEV
  "template-erp-prod": "https://api-XXXXXXXXXX-rj.a.run.app", // PROD - update after deploy
};

const getBaseUrl = (): string => {
  // 1. Explicit override via env var (highest priority)
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // 2. Dynamic selection based on Firebase project
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (projectId && API_URLS[projectId]) {
    return API_URLS[projectId];
  }

  // 3. Fallback to DEV
  console.warn("[API] Unknown project, falling back to DEV API");
  return API_URLS["erp-softcode"];
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const callApi = async <T = unknown>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: unknown
): Promise<T> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated");
  }

  const token = await user.getIdToken();
  const baseUrl = getBaseUrl();

  // Ensure endpoint starts with /
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${path}`;

  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const config: RequestInit = {
    method,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { raw: await response.text() };
      }
      throw new ApiError(
        response.status,
        errorData.message ||
          (typeof errorData.raw === "string"
            ? errorData.raw
            : "API Request Failed"),
        errorData
      );
    }

    // Handle empty responses (e.g. 204 No Content)
    if (response.status === 204) {
      return {} as T;
    }

    return await response.json();
  } catch (error) {
    console.error(`API Call Failed [${method} ${url}]:`, error);
    throw error;
  }
};
