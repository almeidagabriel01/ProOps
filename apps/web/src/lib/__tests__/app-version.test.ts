import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchLiveDeploymentId, isNewerDeployment } from "../app-version";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isNewerDeployment", () => {
  it("versões diferentes: saiu outra publicação", () => {
    expect(isNewerDeployment("dpl_a", "dpl_b")).toBe(true);
  });

  it("mesma versão, ou alguma desconhecida: não", () => {
    expect(isNewerDeployment("dpl_a", "dpl_a")).toBe(false);
    expect(isNewerDeployment("", "dpl_b")).toBe(false);
    expect(isNewerDeployment("dpl_a", null)).toBe(false);
    expect(isNewerDeployment(undefined, undefined)).toBe(false);
  });
});

describe("fetchLiveDeploymentId", () => {
  it("lê a versão publicada, sem cache", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ deploymentId: "dpl_b" }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchLiveDeploymentId()).resolves.toBe("dpl_b");
    expect(fetchMock).toHaveBeenCalledWith("/api/version", { cache: "no-store" });
  });

  it("falha, erro ou resposta sem versão viram null (nunca um aviso falso)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(fetchLiveDeploymentId()).resolves.toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    await expect(fetchLiveDeploymentId()).resolves.toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ deploymentId: null }) }));
    await expect(fetchLiveDeploymentId()).resolves.toBeNull();
  });
});
