import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "../route";

const call = (path: string[]) =>
  GET(new NextRequest(`http://localhost/api/backend/${path.join("/")}`), {
    params: Promise.resolve({ path }),
  });

describe("proxy /api/backend: segmentos de ponto", () => {
  afterEach(() => vi.unstubAllGlobals());

  // Regressão: `..` chegava ao `new URL` do upstream e tirava o caminho de /api.
  it("recusa `..` e `.` antes de chamar o upstream", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    for (const path of [["..", "pdf"], ["v1", "..", "..", "x"], [".", "v1"]]) {
      const res = await call(path);
      expect(res.status).toBe(400);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("proxy /api/backend: cabecalhos do Acessar Painel", () => {
  afterEach(() => vi.unstubAllGlobals());

  // Sem repassar `x-view-as-member` o backend responde como a empresa
  // inteira, e a tela mostraria dado que o membro visto nao ve.
  it("repassa empresa, escrita e membro visto para o backend", async () => {
    const fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    await GET(
      new NextRequest("http://localhost/api/backend/v1/proposals", {
        headers: {
          "x-tenant-id": "t1",
          "x-impersonation-write": "1",
          "x-view-as-member": "vendedor",
        },
      }),
      { params: Promise.resolve({ path: ["v1", "proposals"] }) },
    );
    expect(fetchSpy).toHaveBeenCalled();
    const init = (fetchSpy.mock.calls[0] as unknown as [string, RequestInit])[1];
    const headers = new Headers(init.headers);
    expect(headers.get("x-tenant-id")).toBe("t1");
    expect(headers.get("x-impersonation-write")).toBe("1");
    expect(headers.get("x-view-as-member")).toBe("vendedor");
  });
});
