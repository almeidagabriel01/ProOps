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
      describeFiscalDefaults({ observacoesNota: "Pedido", ipiCst: "50", ipiAliquota: "5", ipiEnquadramento: "" }),
    ).toBe("IPI CST 50, 5%; Observação: Pedido");
    expect(describeFiscalDefaults(EMPTY_FISCAL_DEFAULTS)).toBe("");
  });
});
