import { alertProviderConfigError } from "./provider-error-alert";
import { classifyProviderError } from "./provider-error";
import { captureError } from "../lib/observability/error-logger";
import { logger } from "../lib/logger";

jest.mock("../lib/observability/error-logger", () => ({
  captureError: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../lib/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const captureErrorMock = captureError as jest.MockedFunction<typeof captureError>;
const loggerErrorMock = logger.error as jest.MockedFunction<typeof logger.error>;

const SECRET_KEY = "AIzaSyDFAKEKEYSHOULDNEVERLEAK1234567890";

describe("alertProviderConfigError", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("captures the error with handled:false (critical) and a stable, key-free message", async () => {
    const classification = classifyProviderError(
      new Error('{"error":{"code":400,"status":"INVALID_ARGUMENT","details":[{"reason":"API_KEY_INVALID"}]}}'),
    );
    await alertProviderConfigError(classification, {
      route: "/v1/ai/chat",
      tenantId: "tenant-1",
      uid: "uid-1",
      provider: "gemini",
      modelName: "gemini-2.5-flash",
    });

    expect(captureErrorMock).toHaveBeenCalledTimes(1);
    const [capturedErr, ctx] = captureErrorMock.mock.calls[0];
    expect((capturedErr as Error).message).toBe("AI provider gemini config_invalid_key (INVALID_ARGUMENT)");
    expect((capturedErr as Error).name).toBe("AiProviderConfigError");
    expect(ctx.handled).toBe(false);
    expect(ctx.source).toBe("functions");
    expect(ctx.route).toBe("/v1/ai/chat");
  });

  it("logs a structured error with the stable AI_PROVIDER_CONFIG_ERROR code", async () => {
    const classification = classifyProviderError(new Error("insufficient_quota"));
    await alertProviderConfigError(classification, { route: "/v1/ai/generate-field", provider: "gemini" });

    expect(loggerErrorMock).toHaveBeenCalledWith(
      "AI provider configuration error",
      expect.objectContaining({ code: "AI_PROVIDER_CONFIG_ERROR", category: "quota_exhausted" }),
    );
  });

  it("never leaks the API key into any logged or captured argument", async () => {
    const classification = classifyProviderError(
      new Error(`API key not valid: ${SECRET_KEY}`),
    );
    await alertProviderConfigError(classification, {
      route: "/v1/ai/chat",
      provider: "gemini",
    });

    const serialized = JSON.stringify([
      ...loggerErrorMock.mock.calls,
      ...captureErrorMock.mock.calls.map(([e, c]) => [{ message: (e as Error).message, name: (e as Error).name }, c]),
    ]);
    expect(serialized).not.toContain(SECRET_KEY);
  });

  it("never throws even if captureError rejects", async () => {
    captureErrorMock.mockRejectedValueOnce(new Error("ingest down"));
    const classification = classifyProviderError(new Error("API_KEY_INVALID"));
    await expect(
      alertProviderConfigError(classification, { route: "/v1/ai/chat", provider: "gemini" }),
    ).resolves.toBeUndefined();
  });
});
