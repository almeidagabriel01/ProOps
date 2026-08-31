import {
  mapFocusResponse,
  mapFocusStatus,
  type FocusInvoiceResponse,
} from "./focus-response";
import { isTerminalInvoiceStatus } from "./fiscal-types";

const BASE_URL = "https://homologacao.focusnfe.com.br";

describe("mapFocusStatus", () => {
  it("maps the documented Focus vocabulary", () => {
    expect(mapFocusStatus("autorizado")).toBe("authorized");
    expect(mapFocusStatus("processando_autorizacao")).toBe("processing");
    expect(mapFocusStatus("cancelado")).toBe("cancelled");
    expect(mapFocusStatus("erro_autorizacao")).toBe("rejected");
  });

  it("treats denegado as a permanent rejection", () => {
    // A denied document can never be authorized — retrying only wastes numbers.
    expect(mapFocusStatus("denegado")).toBe("rejected");
    expect(isTerminalInvoiceStatus(mapFocusStatus("denegado"))).toBe(true);
  });

  it("falls back to the retryable status for anything unknown", () => {
    // A new provider status must not strand an invoice in an unrecoverable state.
    expect(mapFocusStatus("status_que_ainda_nao_existe")).toBe("error");
    expect(mapFocusStatus(undefined)).toBe("error");
    expect(mapFocusStatus("")).toBe("error");
  });
});

describe("mapFocusResponse — NF-e", () => {
  const authorized: FocusInvoiceResponse = {
    status: "autorizado",
    status_sefaz: "100",
    mensagem_sefaz: "Autorizado o uso da NF-e",
    chave_nfe: "NFe35260812345678000123550010000000011000000017",
    numero: "1",
    serie: "1",
    protocolo: "135260000000123",
    ref: "inv_abc",
    caminho_xml_nota_fiscal: "/arquivos/xml/nota.xml",
    caminho_danfe: "/arquivos/danfe/nota.pdf",
  };

  it("extracts identifiers and resolves relative document paths", () => {
    const result = mapFocusResponse(authorized, "nfe", "inv_abc", BASE_URL);

    expect(result).toMatchObject({
      ref: "inv_abc",
      status: "authorized",
      type: "nfe",
      numero: "1",
      serie: "1",
      chaveAcesso: "NFe35260812345678000123550010000000011000000017",
      protocolo: "135260000000123",
      pdfUrl: `${BASE_URL}/arquivos/danfe/nota.pdf`,
      xmlUrl: `${BASE_URL}/arquivos/xml/nota.xml`,
    });
  });

  it("does not attach a rejection to an authorized document", () => {
    // status_sefaz 100 is the success code — surfacing it as a rejection would
    // light up the error UI on a perfectly good invoice.
    const result = mapFocusResponse(authorized, "nfe", "inv_abc", BASE_URL);
    expect(result.rejectionCode).toBeUndefined();
    expect(result.rejectionMessage).toBeUndefined();
  });

  it("leaves absolute URLs untouched", () => {
    const result = mapFocusResponse(
      { ...authorized, caminho_danfe: "https://cdn.example.com/d.pdf" },
      "nfe",
      "inv_abc",
      BASE_URL,
    );
    expect(result.pdfUrl).toBe("https://cdn.example.com/d.pdf");
  });

  it("surfaces the SEFAZ code and message on a rejection", () => {
    const result = mapFocusResponse(
      {
        status: "erro_autorizacao",
        status_sefaz: "805",
        mensagem_sefaz: "Rejeicao: A SEFAZ do destinatario nao permite contribuinte isento",
        ref: "inv_805",
      },
      "nfe",
      "inv_805",
      BASE_URL,
    );

    expect(result.status).toBe("rejected");
    expect(result.rejectionCode).toBe("805");
    expect(result.rejectionMessage).toContain("contribuinte isento");
  });

  it("omits document fields that only exist after authorization", () => {
    const result = mapFocusResponse(
      { status: "processando_autorizacao", ref: "inv_pend" },
      "nfe",
      "inv_pend",
      BASE_URL,
    );

    expect(result.status).toBe("processing");
    expect(result.numero).toBeUndefined();
    expect(result.chaveAcesso).toBeUndefined();
    expect(result.pdfUrl).toBeUndefined();
    expect(result.xmlUrl).toBeUndefined();
  });
});

describe("mapFocusResponse — NFS-e", () => {
  it("reads the RPS series and the verification code", () => {
    const result = mapFocusResponse(
      {
        status: "autorizado",
        numero: "42",
        numero_rps: "7",
        serie_rps: "RPS",
        codigo_verificacao: "ABC123XY",
        url: "https://prefeitura.example.gov.br/nfse/42",
        caminho_xml_nota_fiscal: "/arquivos/xml/nfse.xml",
        ref: "inv_svc",
      },
      "nfse",
      "inv_svc",
      BASE_URL,
    );

    expect(result).toMatchObject({
      status: "authorized",
      type: "nfse",
      numero: "42",
      serie: "RPS",
      codigoVerificacao: "ABC123XY",
      publicUrl: "https://prefeitura.example.gov.br/nfse/42",
      xmlUrl: `${BASE_URL}/arquivos/xml/nfse.xml`,
    });
  });

  it("falls back to the itemized errors when there is no SEFAZ message", () => {
    // NFS-e rejections come from the municipality and use `erros`, not `mensagem_sefaz`.
    const result = mapFocusResponse(
      {
        status: "erro_autorizacao",
        erros: [{ codigo: "E123", mensagem: "Inscricao municipal invalida" }],
        ref: "inv_svc_err",
      },
      "nfse",
      "inv_svc_err",
      BASE_URL,
    );

    expect(result.rejectionCode).toBe("E123");
    expect(result.rejectionMessage).toBe("Inscricao municipal invalida");
  });
});

describe("mapFocusResponse — ref handling", () => {
  it("uses the caller's ref when the provider omits it", () => {
    // Focus leaves `ref` out of some synchronous bodies — it is already in the URL.
    const result = mapFocusResponse({ status: "autorizado" }, "nfe", "inv_fallback", BASE_URL);
    expect(result.ref).toBe("inv_fallback");
  });

  it("prefers the provider's ref when both are present", () => {
    const result = mapFocusResponse(
      { status: "autorizado", ref: "inv_provider" },
      "nfe",
      "inv_caller",
      BASE_URL,
    );
    expect(result.ref).toBe("inv_provider");
  });
});
