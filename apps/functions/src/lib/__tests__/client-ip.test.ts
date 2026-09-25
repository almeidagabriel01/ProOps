import {
  PROXY_CLIENT_IP_HEADER,
  PROXY_SECRET_HEADER,
  resolveClientIp,
} from "../client-ip";

const SECRET = { PROXY_CLIENT_IP_SECRET: "proxy-secret-123" };

describe("resolveClientIp", () => {
  // Regressão: o primeiro valor do X-Forwarded-For é de quem chama; o Google
  // acrescenta o IP real no fim. Usar o primeiro deixava forjar a chave.
  it("usa o último valor do X-Forwarded-For, não o primeiro", () => {
    const req = { headers: { "x-forwarded-for": "6.6.6.6, 203.0.113.9" } };
    expect(resolveClientIp(req, {})).toBe("203.0.113.9");
  });

  it("aceita o cabeçalho em forma de lista", () => {
    const req = { headers: { "x-forwarded-for": ["6.6.6.6", "203.0.113.9"] } };
    expect(resolveClientIp(req, {})).toBe("203.0.113.9");
  });

  it("confia no IP repassado pelo proxy quando o segredo confere", () => {
    const req = {
      headers: {
        "x-forwarded-for": "198.51.100.7",
        [PROXY_SECRET_HEADER]: "proxy-secret-123",
        [PROXY_CLIENT_IP_HEADER]: "203.0.113.50",
      },
    };
    expect(resolveClientIp(req, SECRET)).toBe("203.0.113.50");
  });

  it("ignora o IP repassado quando o segredo não confere ou não existe", () => {
    const forged = {
      headers: {
        "x-forwarded-for": "198.51.100.7",
        [PROXY_SECRET_HEADER]: "chute",
        [PROXY_CLIENT_IP_HEADER]: "1.1.1.1",
      },
    };
    expect(resolveClientIp(forged, SECRET)).toBe("198.51.100.7");
    const withSecret = {
      headers: {
        "x-forwarded-for": "198.51.100.7",
        [PROXY_SECRET_HEADER]: "proxy-secret-123",
        [PROXY_CLIENT_IP_HEADER]: "1.1.1.1",
      },
    };
    // Sem o segredo configurado no backend, o cabeçalho nunca vale.
    expect(resolveClientIp(withSecret, {})).toBe("198.51.100.7");
  });

  it("ignora IP repassado que não é um IP", () => {
    const req = {
      headers: {
        "x-forwarded-for": "198.51.100.7",
        [PROXY_SECRET_HEADER]: "proxy-secret-123",
        [PROXY_CLIENT_IP_HEADER]: "not-an-ip",
      },
    };
    expect(resolveClientIp(req, SECRET)).toBe("198.51.100.7");
  });

  it("cai em req.ip e no socket sem cabeçalho", () => {
    expect(resolveClientIp({ headers: {}, ip: "127.0.0.1" }, {})).toBe("127.0.0.1");
    expect(
      resolveClientIp({ headers: {}, socket: { remoteAddress: "::1" } }, {}),
    ).toBe("::1");
    expect(resolveClientIp({ headers: {} }, {})).toBe("unknown");
  });
});
