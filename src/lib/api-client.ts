import { auth } from "./firebase";

// Constants for configuration
// const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
// const REGION = "southamerica-east1";
// const IS_DEV = process.env.NODE_ENV === "development";
// const EMULATOR_HOST = "http://127.0.0.1:5001";

const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // If you want to force local emulator use in dev:
  // if (IS_DEV) return `${EMULATOR_HOST}/${PROJECT_ID}/${REGION}/api`;

  // Production Cloud Run URL (v2)
  return "https://api-2lumykmdwa-rj.a.run.app";
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
