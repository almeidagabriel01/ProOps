jest.mock("./init", () => ({ db: { collection: jest.fn() } }));
jest.mock("./lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("firebase-functions/v2/scheduler", () => ({ onSchedule: jest.fn() }));
jest.mock("./deploymentConfig", () => ({ SCHEDULE_OPTIONS: {} }));

import { resolveAlertMilestone } from "./checkFiscalCertificateExpiry";

describe("resolveAlertMilestone", () => {
  it("avisa exatamente nos marcos definidos", () => {
    expect(resolveAlertMilestone(30)).toBe(30);
    expect(resolveAlertMilestone(15)).toBe(15);
    expect(resolveAlertMilestone(7)).toBe(7);
    expect(resolveAlertMilestone(1)).toBe(1);
  });

  it("fica em silêncio fora dos marcos", () => {
    // Sem isso o usuário receberia notificação todo dia por um mês e passaria
    // a ignorá-las — justamente antes do dia que importa.
    for (const day of [45, 29, 16, 8, 5, 2]) {
      expect(resolveAlertMilestone(day)).toBeNull();
    }
  });

  it("avisa todo dia depois de vencido", () => {
    // Certificado vencido para a emissão por completo: aqui insistir é certo.
    expect(resolveAlertMilestone(-1)).toBe(-1);
    expect(resolveAlertMilestone(-30)).toBe(-1);
  });

  it("não avisa no dia exato do vencimento", () => {
    // Dia 0 ainda emite; o aviso de D-1 já foi dado na véspera.
    expect(resolveAlertMilestone(0)).toBeNull();
  });
});
