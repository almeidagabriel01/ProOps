/**
 * `normalizeOnboardingPayload`: o que o PUT /v1/profile grava em
 * `users/{uid}.onboarding`. A função reconstrói o objeto campo a campo, então
 * um campo que o front passe a mandar e que não esteja aqui é descartado sem
 * erro. Foi o caso das datas de boas-vindas e de primeiros passos.
 */

jest.mock("../../../init", () => ({
  auth: { updateUser: jest.fn() },
  db: { collection: jest.fn(), runTransaction: jest.fn() },
}));

jest.mock("../admin.controller", () => ({
  upsertPhoneNumberIndexTx: jest.fn(),
  normalizePhoneNumber: (v: string) => v,
}));

jest.mock("../../../lib/contact-validation", () => ({
  validateBrazilMobilePhone: jest.fn(() => ({ valid: true })),
}));

jest.mock("../../../lib/whatsapp-eligibility", () => ({
  maybeAutoEnableWhatsApp: jest.fn(async () => undefined),
}));

jest.mock("../../../lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { normalizeOnboardingPayload } from "../users.controller";

const SEEN = "2026-09-20T10:00:00.000Z";
const DISMISSED = "2026-09-21T10:00:00.000Z";

describe("normalizeOnboardingPayload", () => {
  it("grava welcomeSeenAt e firstStepsDismissedAt vindos do front", () => {
    const result = normalizeOnboardingPayload(
      { status: "active", welcomeSeenAt: SEEN, firstStepsDismissedAt: DISMISSED },
      undefined,
    );
    expect(result.welcomeSeenAt).toBe(SEEN);
    expect(result.firstStepsDismissedAt).toBe(DISMISSED);
  });

  it("preserva os marcos gravados quando o payload não os traz", () => {
    const result = normalizeOnboardingPayload(
      { status: "active", completedStepIds: ["dashboard"] },
      { status: "active", welcomeSeenAt: SEEN, firstStepsDismissedAt: DISMISSED },
    );
    expect(result.welcomeSeenAt).toBe(SEEN);
    expect(result.firstStepsDismissedAt).toBe(DISMISSED);
  });

  it("reiniciar a partir de skipped volta para active e zera o progresso", () => {
    const result = normalizeOnboardingPayload(
      { status: "active", completedStepIds: [], version: "core-v2" },
      {
        status: "skipped",
        completedStepIds: ["dashboard", "proposals"],
        skippedAt: DISMISSED,
        welcomeSeenAt: SEEN,
      },
    );
    expect(result.status).toBe("active");
    expect(result.completedStepIds).toEqual([]);
    expect(result.skippedAt).toBeNull();
    expect(result.version).toBe("core-v2");
    expect(result.welcomeSeenAt).toBe(SEEN);
  });

  it("reiniciar a partir de completed limpa completedAt", () => {
    const result = normalizeOnboardingPayload(
      { status: "active", completedStepIds: [] },
      { status: "completed", completedAt: SEEN, completedStepIds: ["dashboard"] },
    );
    expect(result.status).toBe("active");
    expect(result.completedAt).toBeNull();
  });

  it("aceita Timestamp do Firestore nos marcos gravados", () => {
    const result = normalizeOnboardingPayload(
      { status: "active" },
      { welcomeSeenAt: { toDate: () => new Date(SEEN) } },
    );
    expect(result.welcomeSeenAt).toBe(SEEN);
  });

  it("descarta campo desconhecido e valor inválido", () => {
    const result = normalizeOnboardingPayload(
      { status: "hacked", welcomeSeenAt: 42, isAdmin: true },
      undefined,
    );
    expect(result.status).toBe("active");
    expect(result.welcomeSeenAt).toBeNull();
    expect(result).not.toHaveProperty("isAdmin");
  });

  it("conta nova sem marcos grava null nos dois", () => {
    const result = normalizeOnboardingPayload(
      { status: "active", completedStepIds: [], currentStepId: "dashboard" },
      undefined,
    );
    expect(result.welcomeSeenAt).toBeNull();
    expect(result.firstStepsDismissedAt).toBeNull();
    expect(result.currentStepId).toBe("dashboard");
  });
});
