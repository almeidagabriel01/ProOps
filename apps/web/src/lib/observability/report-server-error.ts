import "server-only";
import { headers } from "next/headers";
import { resolveUpstreamForHost } from "@/lib/server-api-upstream";
import { buildClientErrorPayload } from "./report-error";

/**
 * Report an error thrown inside a Server Action / Server Component into the
 * observability pipeline. Best-effort; never throws.
 */
export async function reportServerError(
  err: unknown,
  ctx?: { route?: string; status?: number },
): Promise<void> {
  try {
    const host = (await headers()).get("host");
    const { baseUrl } = resolveUpstreamForHost(host);
    const payload = buildClientErrorPayload(err, { route: ctx?.route, status: ctx?.status });
    await fetch(`${baseUrl}/v1/observability/client-error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => undefined);
  } catch {
    // never throw from the reporter
  }
}
