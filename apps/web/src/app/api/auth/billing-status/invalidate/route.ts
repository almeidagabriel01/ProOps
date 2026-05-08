import { NextRequest, NextResponse } from "next/server";
import { billingCache } from "@/lib/billing-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.BILLING_CACHE_INVALIDATION_SECRET;
  const provided = req.headers.get("x-invalidation-secret");

  if (!secret || !provided || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tenantId =
    body !== null &&
    typeof body === "object" &&
    "tenantId" in body &&
    typeof (body as Record<string, unknown>).tenantId === "string"
      ? ((body as Record<string, unknown>).tenantId as string).trim()
      : "";

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId required" }, { status: 400 });
  }

  billingCache.delete(tenantId);
  return new NextResponse(null, { status: 204 });
}
