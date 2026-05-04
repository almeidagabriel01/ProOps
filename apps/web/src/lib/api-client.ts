import { auth } from "./firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";

/**
 * Browser-side application API always uses the same-origin Next.js proxy.
 */
const getBaseUrl = (): string => {
  return "/api/backend";
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const callApi = async <T = unknown>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: unknown,
): Promise<T> => {
  const getAuthenticatedUser = async (): Promise<FirebaseUser | null> => {
    if (auth.currentUser) return auth.currentUser;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        resolve(null);
      }, 4000);

      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (!firebaseUser) return;
        clearTimeout(timeout);
        unsubscribe();
        resolve(firebaseUser);
      });
    });
  };

  const user = await getAuthenticatedUser();
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

  // When a super admin is viewing a specific tenant's panel, pass the tenant ID
  // so the backend can scope queries correctly (super admin has no tenantId in claims).
  const viewingTenantId =
    typeof window !== "undefined"
      ? sessionStorage.getItem("viewingAsTenant")
      : null;
  if (viewingTenantId) {
    (headers as Record<string, string>)["x-tenant-id"] = viewingTenantId;
  }

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
      const text = await response.text();
      try {
        errorData = JSON.parse(text);
      } catch {
        errorData = { raw: text };
      }
      throw new ApiError(
        response.status,
        errorData.message ||
          (typeof errorData.raw === "string"
            ? errorData.raw
            : "API Request Failed"),
        errorData,
      );
    }

    // Handle empty responses (e.g. 204 No Content)
    if (response.status === 204) {
      return {} as T;
    }

    return await response.json();
  } catch (error) {
    console.error(
      `API Call Failed [${method} ${url}]`,
      {
        baseUrl,
        origin:
          typeof window !== "undefined" ? window.location.origin : "server",
      },
      error,
    );
    throw error;
  }
};

/**
 * Call API without authentication (public endpoints)
 */
export const callPublicApi = async <T = unknown>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: unknown,
  options?: RequestInit,
): Promise<T> => {
  const baseUrl = getBaseUrl();

  // Ensure endpoint starts with /
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${path}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  const config: RequestInit = {
    method,
    headers,
    ...options,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      let errorData;
      const text = await response.text();
      try {
        errorData = JSON.parse(text);
      } catch {
        errorData = { raw: text };
      }
      throw new ApiError(
        response.status,
        errorData.message ||
          (typeof errorData.raw === "string"
            ? errorData.raw
            : "API Request Failed"),
        errorData,
      );
    }

    // Handle empty responses (e.g. 204 No Content)
    if (response.status === 204) {
      return {} as T;
    }

    return await response.json();
  } catch (error) {
    console.error(
      `Public API Call Failed [${method} ${url}]`,
      {
        baseUrl,
        origin:
          typeof window !== "undefined" ? window.location.origin : "server",
      },
      error,
    );
    throw error;
  }
};
