import { describe, expect, it } from "vitest";
import {
  EMPTY_FISCAL_DEFAULTS,
  describeFiscalDefaults,
  fiscalDefaultsFromClient,
  fiscalDefaultsToPayload,
} from "../client-fiscal-defaults";

describe("padrão fiscal do contato", () => {
  it("vazio grava null, que apaga o padrão", () => {
    expect(fiscalDefaultsToPayload(EMPTY_FISCAL_DEFAULTS)).toBeNull();
  });

  it("IPI e observação vão juntos", () => {
    expect(
      fiscalDefaultsToPayload({
        ...EMPTY_FISCAL_DEFAULTS,
        observacoesNota: " IPI conforme pedido ",
        ipiCst: "50",
        ipiAliquota: "5",
        ipiEnquadramento: "",
      }),
    ).toEqual({ observacoes: "IPI conforme pedido", ipi: { cst: "50", aliquota: 5 } });
  });

  it("ida e volta pelo cadastro", () => {
    const values = fiscalDefaultsFromClient({
      fiscalDefaults: { observacoes: "Obs", ipi: { cst: "99", aliquota: 3.5, codigoEnquadramento: "999" } },
    });
    expect(values).toEqual({
      ...EMPTY_FISCAL_DEFAULTS,
      observacoesNota: "Obs",
      ipiCst: "99",
      ipiAliquota: "3,5",
      ipiEnquadramento: "999",
    });
    expect(fiscalDefaultsToPayload(values)).toEqual({
      observacoes: "Obs",
      ipi: { cst: "99", aliquota: 3.5, codigoEnquadramento: "999" },
    });
  });

  it("contato sem padrão", () => {
    expect(fiscalDefaultsFromClient({})).toEqual(EMPTY_FISCAL_DEFAULTS);
    expect(fiscalDefaultsFromClient({ fiscalDefaults: null })).toEqual(EMPTY_FISCAL_DEFAULTS);
  });

  it("resumo para a ficha", () => {
    expect(
      describeFiscalDefaults({
        ...EMPTY_FISCAL_DEFAULTS,
        observacoesNota: "Pedido",
        ipiCst: "50",
        ipiAliquota: "5",
      }),
    ).toBe("IPI CST 50, 5%; Observação: Pedido");
    expect(describeFiscalDefaults(EMPTY_FISCAL_DEFAULTS)).toBe("");
  });

  it("cliente 101 da AWA: só o CSOSN, e o crédito vem da empresa", () => {
    const payload = fiscalDefaultsToPayload({ ...EMPTY_FISCAL_DEFAULTS, icmsSituacao: "101" });
    expect(payload).toEqual({ icms: { situacao: "101" } });
    expect(fiscalDefaultsFromClient({ fiscalDefaults: payload })).toEqual({
      ...EMPTY_FISCAL_DEFAULTS,
      icmsSituacao: "101",
    });
    expect(describeFiscalDefaults({ ...EMPTY_FISCAL_DEFAULTS, icmsSituacao: "101", icmsAliquotaCredito: "1,25" })).toBe(
      "ICMS CSOSN 101, crédito de 1,25%",
    );
  });

  it("só manda o que o código aceita", () => {
    expect(
      fiscalDefaultsToPayload({
        ...EMPTY_FISCAL_DEFAULTS,
        icmsSituacao: "102",
        icmsAliquota: "18",
        icmsAliquotaCredito: "1,25",
        pisCst: "07",
        pisAliquota: "0,65",
        cofinsCst: "01",
        cofinsAliquota: "3",
      }),
    ).toEqual({ icms: { situacao: "102" }, pis: { cst: "07" }, cofins: { cst: "01", aliquota: 3 } });
    expect(
      fiscalDefaultsToPayload({ ...EMPTY_FISCAL_DEFAULTS, icmsSituacao: "00", icmsAliquota: "17", icmsReducaoBase: "" }),
    ).toEqual({ icms: { situacao: "00", aliquota: 17 } });
  });
});
