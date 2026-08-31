import {
  mapReceivedInvoice,
  mapReceivedStatus,
  maxVersionOf,
} from "./received-invoice-mapper";
import {
  requiresJustification,
  shouldApplyReceivedVersion,
  unlocksFullXml,
} from "./received-invoice.types";

const CHAVE = "35260812345678000123550010000000011000000017";

describe("mapReceivedStatus", () => {
  it("distingue resumo de nota completa pelos itens", () => {
    // Antes da manifestação a Receita entrega só o resumo — sem itens.
    expect(mapReceivedStatus(undefined, false)).toBe("resumo");
    expect(mapReceivedStatus(undefined, true)).toBe("completa");
  });

  it("cancelamento vence a presença de itens", () => {
    // Uma nota cancelada pelo emitente não pode voltar a parecer válida só
    // porque os itens vieram junto — seria divergência na contabilidade.
    expect(mapReceivedStatus("cancelada", true)).toBe("cancelada");
    expect(mapReceivedStatus("Denegada pela SEFAZ", true)).toBe("cancelada");
  });
});

describe("mapReceivedInvoice", () => {
  const resumo = {
    chave_nfe: CHAVE,
    versao: 60,
    cnpj_emitente: "11.222.333/0001-81",
    nome_emitente: "Casas Bahia Comercial Ltda",
    uf_emitente: "sp",
    numero: 12345,
    serie: 1,
    data_emissao: "2026-08-20T10:00:00-03:00",
    valor_total: "2500,00",
  };

  it("normaliza documento, UF e valor com vírgula decimal", () => {
    const mapped = mapReceivedInvoice(resumo, "tenant-1");

    expect(mapped.chaveAcesso).toBe(CHAVE);
    expect(mapped.emitenteCnpj).toBe("11222333000181");
    expect(mapped.emitenteUf).toBe("SP");
    expect(mapped.valorTotal).toBe(2500);
    expect(mapped.versao).toBe(60);
  });

  it("marca como resumo e omite itens antes da manifestação", () => {
    const mapped = mapReceivedInvoice(resumo, "tenant-1");

    expect(mapped.status).toBe("resumo");
    // Array vazio faria a UI dizer "nota sem itens" em vez de
    // "aguardando confirmação".
    expect(mapped).not.toHaveProperty("itens");
  });

  it("extrai o NCM dos itens — a razão de ser do módulo", () => {
    const mapped = mapReceivedInvoice(
      {
        ...resumo,
        itens: [
          {
            numero_item: 1,
            codigo_produto: "CORT-9911",
            descricao: "Cortina blackout 3m",
            codigo_ncm: "6303.92.00",
            cfop: "6102",
            unidade_comercial: "UN",
            quantidade_comercial: "2",
            valor_unitario_comercial: "1250,00",
            valor_bruto: "2500,00",
          },
        ],
      },
      "tenant-1",
    );

    expect(mapped.status).toBe("completa");
    expect(mapped.itens).toHaveLength(1);
    expect(mapped.itens![0].ncm).toBe("63039200");
    expect(mapped.itens![0].descricao).toBe("Cortina blackout 3m");
    expect(mapped.itens![0].valorTotal).toBe(2500);
  });

  it("deriva o valor unitário quando o provedor não manda", () => {
    const mapped = mapReceivedInvoice(
      {
        ...resumo,
        itens: [{ descricao: "Motor", quantidade_comercial: 4, valor_bruto: 1000 }],
      },
      "tenant-1",
    );

    expect(mapped.itens![0].valorUnitario).toBe(250);
    expect(mapped.itens![0].numero).toBe(1);
  });

  it("recusa nota sem chave de acesso", () => {
    // A chave é a identidade do documento e a nossa chave de deduplicação —
    // sem ela não há o que gravar.
    expect(() => mapReceivedInvoice({ ...resumo, chave_nfe: undefined }, "t1")).toThrow(
      "NOTA_RECEBIDA_SEM_CHAVE",
    );
    expect(() => mapReceivedInvoice({ ...resumo, chave_nfe: "123" }, "t1")).toThrow(
      "NOTA_RECEBIDA_SEM_CHAVE",
    );
  });
});

describe("maxVersionOf", () => {
  it("devolve a maior versão do lote", () => {
    expect(maxVersionOf([{ versao: 10 }, { versao: 87 }, { versao: 42 }])).toBe(87);
  });

  it("devolve zero para lote vazio ou sem versão", () => {
    expect(maxVersionOf([])).toBe(0);
    expect(maxVersionOf([{ chave_nfe: CHAVE }])).toBe(0);
  });
});

describe("shouldApplyReceivedVersion", () => {
  it("aceita a primeira versão vista", () => {
    expect(shouldApplyReceivedVersion(undefined, 60)).toBe(true);
  });

  it("aceita versão maior", () => {
    expect(shouldApplyReceivedVersion(60, 61)).toBe(true);
  });

  it("recusa versão igual ou menor", () => {
    // Aceitar uma versão menor sobrescreveria um cancelamento com o estado
    // anterior, e a nota voltaria a parecer válida.
    expect(shouldApplyReceivedVersion(60, 60)).toBe(false);
    expect(shouldApplyReceivedVersion(61, 60)).toBe(false);
  });
});

describe("regras de manifestação", () => {
  it("só a confirmação libera o XML completo", () => {
    expect(unlocksFullXml("confirmacao")).toBe(true);
    expect(unlocksFullXml("ciencia")).toBe(false);
    expect(unlocksFullXml("desconhecimento")).toBe(false);
    expect(unlocksFullXml("nao_realizada")).toBe(false);
  });

  it("só operação não realizada exige justificativa", () => {
    expect(requiresJustification("nao_realizada")).toBe(true);
    expect(requiresJustification("confirmacao")).toBe(false);
    expect(requiresJustification("desconhecimento")).toBe(false);
  });
});
