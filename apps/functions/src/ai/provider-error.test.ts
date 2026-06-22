import { classifyProviderError } from "./provider-error";

/**
 * Exact payload observed in production logs (erp-softcode-prod, 2026-06-22):
 * the @google/genai SDK throws an Error whose `.message` is this JSON string.
 */
const PROD_API_KEY_INVALID_MESSAGE = JSON.stringify({
  error: {
    code: 400,
    message: "API key not valid. Please pass a valid API key.",
    status: "INVALID_ARGUMENT",
    details: [
      {
        "@type": "type.googleapis.com/google.rpc.ErrorInfo",
        reason: "API_KEY_INVALID",
        domain: "googleapis.com",
        metadata: { service: "generativelanguage.googleapis.com" },
      },
      {
        "@type": "type.googleapis.com/google.rpc.LocalizedMessage",
        locale: "en-US",
        message: "API key not valid. Please pass a valid API key.",
      },
    ],
  },
});

describe("classifyProviderError", () => {
  it("classifies the exact prod API_KEY_INVALID payload as config_invalid_key", () => {
    const result = classifyProviderError(new Error(PROD_API_KEY_INVALID_MESSAGE));
    expect(result.category).toBe("config_invalid_key");
    expect(result.providerReason).toBe("API_KEY_INVALID");
    expect(result.providerStatus).toBe("INVALID_ARGUMENT");
    expect(result.httpCode).toBe(400);
    expect(result.operatorActionable).toBe(true);
    expect(result.clientMessage).toContain("temporariamente indisponível");
  });

  it("classifies PERMISSION_DENIED / 403 as config_invalid_key", () => {
    const result = classifyProviderError(
      new Error('{"error":{"code":403,"status":"PERMISSION_DENIED","message":"Permission denied"}}'),
    );
    expect(result.category).toBe("config_invalid_key");
    expect(result.httpCode).toBe(403);
    expect(result.operatorActionable).toBe(true);
  });

  it("classifies RESOURCE_EXHAUSTED quota as quota_exhausted", () => {
    const result = classifyProviderError(
      new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED","message":"You exceeded your current quota"}}'),
    );
    expect(result.category).toBe("quota_exhausted");
    expect(result.operatorActionable).toBe(true);
  });

  it("classifies a plain quota message as quota_exhausted", () => {
    const result = classifyProviderError(new Error("Error: insufficient_quota for this project"));
    expect(result.category).toBe("quota_exhausted");
  });

  it("classifies a bare 429 (no quota) as rate_limited and not actionable", () => {
    const result = classifyProviderError(new Error("Got 429 Too Many Requests"));
    expect(result.category).toBe("rate_limited");
    expect(result.operatorActionable).toBe(false);
    expect(result.clientMessage).toContain("sobrecarregado");
  });

  it("prioritizes quota over rate_limited when both 429 and quota are present", () => {
    const result = classifyProviderError(
      new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED","message":"429: quota exceeded"}}'),
    );
    expect(result.category).toBe("quota_exhausted");
  });

  it("classifies a Groq invalid api key (401) as config_invalid_key", () => {
    const result = classifyProviderError(new Error("401 Invalid API Key provided"));
    expect(result.category).toBe("config_invalid_key");
  });

  it("classifies a Groq rate_limit_exceeded as rate_limited", () => {
    const result = classifyProviderError(new Error("429 rate_limit_exceeded: please slow down"));
    expect(result.category).toBe("rate_limited");
  });

  it("classifies 503 / network errors as transient", () => {
    expect(classifyProviderError(new Error("503 Service Unavailable")).category).toBe("transient");
    expect(classifyProviderError(new Error("read ECONNRESET")).category).toBe("transient");
    expect(classifyProviderError(new Error("fetch failed")).category).toBe("transient");
  });

  it("reads a numeric .status off an SDK-shaped error object", () => {
    const sdkError = Object.assign(new Error("Service Unavailable"), { status: 503 });
    expect(classifyProviderError(sdkError).category).toBe("transient");
    expect(classifyProviderError(sdkError).httpCode).toBe(503);
  });

  it("returns unknown with the generic message for unrecognized errors", () => {
    const result = classifyProviderError(new Error("something weird happened"));
    expect(result.category).toBe("unknown");
    expect(result.operatorActionable).toBe(false);
    expect(result.clientMessage).toBe("Erro ao processar resposta da IA.");
  });

  it("never throws on null, undefined, empty object, or non-Error values", () => {
    expect(() => classifyProviderError(null)).not.toThrow();
    expect(() => classifyProviderError(undefined)).not.toThrow();
    expect(() => classifyProviderError({})).not.toThrow();
    expect(() => classifyProviderError(42)).not.toThrow();
    expect(classifyProviderError(null).category).toBe("unknown");
    expect(classifyProviderError({}).category).toBe("unknown");
  });
});
