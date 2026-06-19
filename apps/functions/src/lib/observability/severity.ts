import type { ErrorSeverity, ErrorSource } from "../../shared/error-observability.types";

export function mapSeverity(input: {
  status: number | null;
  source: ErrorSource;
  handled: boolean;
}): ErrorSeverity {
  const { status, handled } = input;
  if (!handled) return "critical";
  if (typeof status === "number" && status >= 500) return "critical";
  if (typeof status === "number" && status >= 400 && status < 500) return "warning";
  return "error";
}
