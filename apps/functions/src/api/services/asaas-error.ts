import axios from "axios";

export interface AsaasErrorDetail {
  httpStatus?: number;
  asaasErrors?: Array<{ code?: string; description?: string }>;
  message: string;
}

/**
 * Extracts a structured error description from an unknown thrown value.
 * Handles Axios errors with Asaas API response bodies, plain Error objects,
 * and arbitrary unknowns. Never leaks secrets — only extracts Asaas-side
 * error codes and descriptions.
 */
export function describeAsaasError(err: unknown): AsaasErrorDetail {
  if (axios.isAxiosError(err)) {
    const httpStatus = err.response?.status;
    const responseData = err.response?.data as
      | { errors?: Array<{ code?: string; description?: string }>; message?: string }
      | undefined;

    const asaasErrors = Array.isArray(responseData?.errors)
      ? (responseData!.errors as Array<{ code?: string; description?: string }>).filter(
          (e) => e && (e.code !== undefined || e.description !== undefined),
        )
      : undefined;

    const message =
      asaasErrors?.[0]?.description ||
      (typeof responseData?.message === "string" ? responseData.message : null) ||
      err.message;

    return {
      httpStatus,
      ...(asaasErrors?.length ? { asaasErrors } : {}),
      message,
    };
  }

  if (err instanceof Error) {
    return { message: err.message };
  }

  return { message: String(err) };
}
