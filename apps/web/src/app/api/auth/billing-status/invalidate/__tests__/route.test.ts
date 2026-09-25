import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({ revalidateTag: (...a: unknown[]) => revalidateTag(...a) }));

import { POST } from "../route";

function request(secret: string | null) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret !== null) headers["x-invalidation-secret"] = secret;
  return new NextRequest("http://localhost/api/auth/billing-status/invalidate", {
    method: "POST",
    headers,
    body: JSON.stringify({ tenantId: "t1" }),
  });
}

describe("POST /api/auth/billing-status/invalidate", () => {
  beforeEach(() => {
    vi.stubEnv("BILLING_CACHE_INVALIDATION_SECRET", "s3cret-value");
    revalidateTag.mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("invalida com o segredo certo", async () => {
    const res = await POST(request("s3cret-value"));
    expect(res.status).toBe(204);
    expect(revalidateTag).toHaveBeenCalledWith("billing-status:t1");
  });

  it("recusa segredo errado, de outro tamanho ou ausente", async () => {
    for (const secret of ["s3cret-valuX", "s3cret", "s3cret-value-longer", null]) {
      const res = await POST(request(secret));
      expect(res.status).toBe(401);
    }
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("falha fechado quando o segredo não está configurado", async () => {
    vi.stubEnv("BILLING_CACHE_INVALIDATION_SECRET", "");
    const res = await POST(request(""));
    expect(res.status).toBe(401);
  });
});
