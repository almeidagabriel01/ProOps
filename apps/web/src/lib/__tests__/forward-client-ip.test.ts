import { describe, it, expect } from "vitest";
import {
  applyClientIpForwarding,
  PROXY_CLIENT_IP_HEADER,
  PROXY_SECRET_HEADER,
} from "../forward-client-ip";

describe("applyClientIpForwarding", () => {
  it("repassa o IP da borda com o segredo", () => {
    const out = new Headers();
    applyClientIpForwarding(new Headers({ "x-real-ip": "203.0.113.5" }), out, "s3cret");
    expect(out.get(PROXY_CLIENT_IP_HEADER)).toBe("203.0.113.5");
    expect(out.get(PROXY_SECRET_HEADER)).toBe("s3cret");
  });

  it("usa o x-forwarded-for quando não há x-real-ip", () => {
    const out = new Headers();
    applyClientIpForwarding(
      new Headers({ "x-forwarded-for": "203.0.113.6, 10.0.0.1" }),
      out,
      "s3cret",
    );
    expect(out.get(PROXY_CLIENT_IP_HEADER)).toBe("203.0.113.6");
  });

  it("não envia nada sem o segredo configurado", () => {
    const out = new Headers();
    applyClientIpForwarding(new Headers({ "x-real-ip": "203.0.113.5" }), out, "");
    expect(out.get(PROXY_CLIENT_IP_HEADER)).toBeNull();
    expect(out.get(PROXY_SECRET_HEADER)).toBeNull();
  });
});
