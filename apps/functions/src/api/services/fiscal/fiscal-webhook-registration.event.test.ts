/**
 * O gatilho tem que ser registrado no MESMO evento em que a nota é emitida.
 *
 * Registrar `nfse` e emitir em `nfsen` não dá erro em lugar nenhum: o registro
 * é aceito, a emissão é aceita, e a notificação simplesmente nunca chega. A
 * nota fica presa em `processing` até o cron de 15 minutos.
 *
 * Foi exatamente o que aconteceu com a primeira nota real: ela já estava
 * rejeitada no Ambiente Nacional enquanto a ProOps ainda mostrava
 * "Processando". Nenhum log, nenhum erro — só silêncio.
 */

import { resolveResourcePath } from "./focus.provider";

jest.mock("axios");
jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe("resolveResourcePath — evento do gatilho e recurso de emissão", () => {
  it("NFS-e nacional usa nfsen nos dois", () => {
    // O nome do evento e o do recurso são o mesmo. Essa coincidência é o que
    // permite derivar um do outro em vez de manter duas listas que divergem.
    expect(resolveResourcePath("nfse", "nacional")).toBe("nfsen");
  });

  it("NFS-e municipal usa nfse nos dois", () => {
    expect(resolveResourcePath("nfse", "municipal")).toBe("nfse");
  });

  it("sem padrão informado, assume nacional", () => {
    expect(resolveResourcePath("nfse")).toBe("nfsen");
    expect(resolveResourcePath("nfse", undefined)).toBe("nfsen");
  });

  it("NF-e não é afetada pelo padrão da NFS-e", () => {
    expect(resolveResourcePath("nfe", "municipal")).toBe("nfe");
    expect(resolveResourcePath("nfe", "nacional")).toBe("nfe");
  });
});
