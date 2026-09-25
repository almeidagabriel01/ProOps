const mockGet = jest.fn();
const mockSet = jest.fn();
jest.mock("../../init", () => ({
  db: {
    collection: () => ({
      doc: (id: string) => ({
        id,
        get: () => mockGet(id),
        set: (value: unknown) => mockSet(id, value),
      }),
    }),
  },
}));

import { Timestamp } from "firebase-admin/firestore";
import {
  clearMfaSessionCacheForTest,
  isMfaSessionVerified,
  isWhatsappMfaExemptPath,
  isWhatsappMfaPending,
  mfaSessionDocId,
  recordVerifiedMfaSession,
  userHasWhatsappMfa,
} from "../whatsapp-mfa-session";

const BASE = {
  whatsappMfaEnabled: true,
  isSuperAdmin: false,
  nativeSecondFactor: false,
  recoveryLogin: false,
  whatsappLogin: false,
  sessionVerified: false,
};

describe("isWhatsappMfaPending", () => {
  // Regressão: só a senha rendia um ID token que a API aceitava sem o código.
  it("exige o código de quem tem o WhatsApp ativo e não o passou neste login", () => {
    expect(isWhatsappMfaPending(BASE)).toBe(true);
  });

  it("libera quem passou o código neste login", () => {
    expect(isWhatsappMfaPending({ ...BASE, sessionVerified: true })).toBe(false);
  });

  it("libera os outros caminhos que já satisfazem o 2FA", () => {
    expect(isWhatsappMfaPending({ ...BASE, nativeSecondFactor: true })).toBe(false);
    expect(isWhatsappMfaPending({ ...BASE, recoveryLogin: true })).toBe(false);
    expect(isWhatsappMfaPending({ ...BASE, whatsappLogin: true })).toBe(false);
  });

  it("não se aplica a quem não tem o WhatsApp ativo nem a superadmin", () => {
    expect(isWhatsappMfaPending({ ...BASE, whatsappMfaEnabled: false })).toBe(false);
    expect(isWhatsappMfaPending({ ...BASE, isSuperAdmin: true })).toBe(false);
  });
});

describe("userHasWhatsappMfa", () => {
  it("exige a flag E o telefone, como o challenge", () => {
    expect(
      userHasWhatsappMfa({ whatsappMfaEnabled: true, whatsappMfaPhone: "5511999998888" }),
    ).toBe(true);
    expect(userHasWhatsappMfa({ whatsappMfaEnabled: true })).toBe(false);
    expect(userHasWhatsappMfa({ whatsappMfaEnabled: false, whatsappMfaPhone: "5511" })).toBe(
      false,
    );
    expect(userHasWhatsappMfa(undefined)).toBe(false);
  });
});

describe("isWhatsappMfaExemptPath", () => {
  it("isenta só as rotas que o login usa antes do código", () => {
    expect(isWhatsappMfaExemptPath("/v1/auth/whatsapp-mfa/challenge")).toBe(true);
    expect(isWhatsappMfaExemptPath("/v1/auth/whatsapp-mfa/verify")).toBe(true);
    expect(isWhatsappMfaExemptPath("/v1/auth/recovery-codes/verify/")).toBe(true);
  });

  // Os atalhos de quem só tem a senha: desligar o 2FA, trocar o número e
  // gerar códigos de recuperação novos.
  it("NÃO isenta desligar, recadastrar ou gerar códigos", () => {
    expect(isWhatsappMfaExemptPath("/v1/auth/whatsapp-mfa/disable")).toBe(false);
    expect(isWhatsappMfaExemptPath("/v1/auth/whatsapp-mfa/enroll/start")).toBe(false);
    expect(isWhatsappMfaExemptPath("/v1/auth/whatsapp-mfa/enroll/verify")).toBe(false);
    expect(isWhatsappMfaExemptPath("/v1/auth/recovery-codes/generate")).toBe(false);
    expect(isWhatsappMfaExemptPath("/v1/proposals")).toBe(false);
  });
});

describe("sessão verificada", () => {
  beforeEach(() => {
    clearMfaSessionCacheForTest();
    mockGet.mockReset();
    mockSet.mockReset();
  });

  it("a chave é uid + auth_time do login", () => {
    expect(mfaSessionDocId("u1", 1_700_000_000)).toBe("u1_1700000000");
  });

  it("sem auth_time nunca conta como verificada", async () => {
    expect(await isMfaSessionVerified("u1", undefined)).toBe(false);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("marca vencida não vale", async () => {
    mockGet.mockResolvedValue({ exists: true, get: () => Timestamp.fromMillis(1_000) });
    expect(await isMfaSessionVerified("u1", 1_700_000_000, 2_000)).toBe(false);
  });

  it("marca válida vale, e a resposta positiva fica em cache", async () => {
    mockGet.mockResolvedValue({ exists: true, get: () => Timestamp.fromMillis(10_000) });
    expect(await isMfaSessionVerified("u1", 1_700_000_000, 2_000)).toBe(true);
    expect(await isMfaSessionVerified("u1", 1_700_000_000, 2_000)).toBe(true);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  // Negativa não pode ficar em cache: prenderia a pessoa logo depois de
  // digitar o código certo.
  it("resposta negativa é conferida de novo", async () => {
    mockGet.mockResolvedValue({ exists: false, get: () => undefined });
    await isMfaSessionVerified("u1", 1_700_000_000);
    await isMfaSessionVerified("u1", 1_700_000_000);
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it("gravar a marca vale na hora, sem nova leitura", async () => {
    await recordVerifiedMfaSession("u1", 1_700_000_000, "whatsapp", 5_000);
    expect(mockSet).toHaveBeenCalledWith(
      "u1_1700000000",
      expect.objectContaining({ uid: "u1", authTime: 1_700_000_000, method: "whatsapp" }),
    );
    expect(await isMfaSessionVerified("u1", 1_700_000_000)).toBe(true);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("recusa gravar sem auth_time", async () => {
    await expect(recordVerifiedMfaSession("u1", undefined, "whatsapp")).rejects.toThrow(
      "MFA_SESSION_WITHOUT_AUTH_TIME",
    );
  });
});
