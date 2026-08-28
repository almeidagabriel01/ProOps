jest.mock("../../../init", () => ({ db: { collection: jest.fn() } }));
jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { buildInvoiceRef, canApplyStatus } from "./invoice.service";
import type { FiscalInvoiceStatus } from "./fiscal-types";

describe("buildInvoiceRef", () => {
  it("é determinístico no id da nota", () => {
    // A referência é a chave de idempotência do provedor: reenviar o mesmo
    // documento tem que reusar a mesma ref, senão sai uma segunda nota.
    expect(buildInvoiceRef("abc123")).toBe("proops-abc123");
    expect(buildInvoiceRef("abc123")).toBe(buildInvoiceRef("abc123"));
  });

  it("gera referências distintas para notas distintas", () => {
    expect(buildInvoiceRef("a")).not.toBe(buildInvoiceRef("b"));
  });
});

describe("canApplyStatus", () => {
  const naoTerminais: FiscalInvoiceStatus[] = ["draft", "processing", "error"];
  const terminais: FiscalInvoiceStatus[] = ["authorized", "cancelled", "rejected"];

  it("avança livremente a partir de status não terminal", () => {
    for (const atual of naoTerminais) {
      expect(canApplyStatus(atual, "authorized")).toBe(true);
      expect(canApplyStatus(atual, "rejected")).toBe(true);
    }
  });

  it("ignora evento repetido do mesmo status", () => {
    // Entrega duplicada do webhook não deve reprocessar efeitos colaterais.
    for (const status of [...naoTerminais, ...terminais]) {
      expect(canApplyStatus(status, status)).toBe(false);
    }
  });

  it("nunca regride de autorizada para processando", () => {
    // Webhooks não são ordenados e o cron de consulta pode correr junto: sem
    // essa guarda, um "processando" atrasado devolveria a nota autorizada
    // para a fila de retentativa.
    expect(canApplyStatus("authorized", "processing")).toBe(false);
    expect(canApplyStatus("authorized", "error")).toBe(false);
    expect(canApplyStatus("authorized", "draft")).toBe(false);
  });

  it("nunca reabre nota rejeitada ou cancelada", () => {
    for (const atual of ["rejected", "cancelled"] as FiscalInvoiceStatus[]) {
      for (const alvo of ["processing", "authorized", "error"] as FiscalInvoiceStatus[]) {
        expect(canApplyStatus(atual, alvo)).toBe(false);
      }
    }
  });

  it("permite a única transição real a partir de terminal: autorizada → cancelada", () => {
    expect(canApplyStatus("authorized", "cancelled")).toBe(true);
  });
});
