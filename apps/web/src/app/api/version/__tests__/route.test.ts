import { describe, it, expect, afterEach, vi } from "vitest";
import { GET } from "../route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/version", () => {
  it("devolve a publicação no ar, sem cache", async () => {
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_b");
    const response = GET();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ deploymentId: "dpl_b" });
  });

  it("fora da Vercel devolve null", async () => {
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "");
    await expect(GET().json()).resolves.toEqual({ deploymentId: null });
  });
});
