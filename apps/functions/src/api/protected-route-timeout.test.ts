/**
 * Orcamento de tempo das rotas protegidas.
 *
 * O middleware de timeout responde 408 "Request timeout" e **deixa o handler
 * correndo**. Quando o teto e curto demais para a operacao, o desfecho e o pior
 * possivel: o trabalho termina, o dado fica gravado, e o usuario ve um erro.
 * Foi o que aconteceu ao aprovar uma proposta — a mudanca de status valia, mas
 * so aparecia depois de recarregar a pagina.
 *
 * Escrita de proposta e cara porque sair do rascunho dispara a entrega no
 * Google Drive, que renderiza o PDF com Chromium dentro da request.
 */

jest.mock("../init", () => ({ db: {}, auth: {}, adminApp: {} }));

import type { Request } from "express";
import { resolveProtectedRouteTimeoutMs } from "./index";

function req(method: string, originalUrl: string): Request {
  return { method, originalUrl, url: originalUrl, path: originalUrl } as Request;
}

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("resolveProtectedRouteTimeoutMs", () => {
  it("rota comum tem o teto curto", () => {
    expect(resolveProtectedRouteTimeoutMs(req("GET", "/v1/clients"))).toBe(
      20_000,
    );
    expect(
      resolveProtectedRouteTimeoutMs(req("POST", "/v1/transactions")),
    ).toBe(20_000);
  });

  it("download de PDF continua com o teto longo", () => {
    expect(
      resolveProtectedRouteTimeoutMs(req("GET", "/v1/proposals/p1/pdf")),
    ).toBe(120_000);
  });

  it.each([
    ["PUT", "/v1/proposals/p1"],
    ["POST", "/v1/proposals"],
    ["PUT", "/v1/proposals/p1?foo=1"],
  ])("%s %s ganha orcamento proprio", (method, url) => {
    expect(resolveProtectedRouteTimeoutMs(req(method, url))).toBe(60_000);
  });

  it("leitura de proposta nao ganha o orcamento longo", () => {
    // Nao renderiza PDF nenhum; herdar o teto longo so atrasaria a deteccao de
    // uma consulta travada.
    expect(resolveProtectedRouteTimeoutMs(req("GET", "/v1/proposals"))).toBe(
      20_000,
    );
    expect(
      resolveProtectedRouteTimeoutMs(req("DELETE", "/v1/proposals/p1")),
    ).toBe(20_000);
  });

  it("nao vaza para rotas que so PARECEM de proposta", () => {
    expect(
      resolveProtectedRouteTimeoutMs(req("PUT", "/v1/proposal-templates/t1")),
    ).toBe(20_000);
    expect(
      resolveProtectedRouteTimeoutMs(req("POST", "/v1/shared-proposals")),
    ).toBe(20_000);
  });

  // O backend tem que responder ANTES de o proxy abortar (80s), senao a
  // mensagem util e trocada por um erro generico de rede.
  it("o orcamento da proposta cabe dentro do teto do proxy", () => {
    expect(
      resolveProtectedRouteTimeoutMs(req("PUT", "/v1/proposals/p1")),
    ).toBeLessThan(80_000);
  });

  it("da para ajustar por variavel de ambiente", () => {
    process.env.PROTECTED_PROPOSAL_WRITE_TIMEOUT_MS = "45000";
    expect(resolveProtectedRouteTimeoutMs(req("PUT", "/v1/proposals/p1"))).toBe(
      45_000,
    );
  });
});
