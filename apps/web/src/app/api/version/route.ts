import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/version
 *
 * A versão publicada agora (`VERCEL_DEPLOYMENT_ID`). A aba compara com a que
 * veio embutida no próprio JavaScript (`lib/app-version.ts`) para saber que
 * ficou para trás. Público e sem dado nenhum além do id da publicação.
 */
export function GET() {
  return NextResponse.json(
    { deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
