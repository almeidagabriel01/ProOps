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
