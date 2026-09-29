import {
  CompleteServiceOrderSchema,
  ExecutionUpdateSchema,
  UpdateServiceOrderSchema,
  canTransition,
  computeOrderTotals,
  decodeSignatureDataUrl,
  formatOrderCode,
  signatureContentHash,
  stockConsumption,
  stockDelta,
  type ServiceOrderItem,
} from "./field-service-model";

const item = (over: Partial<ServiceOrderItem>): ServiceOrderItem => ({
  id: "i1",
  kind: "product",
  refId: "p1",
  name: "Capacitor",
  quantity: 1,
  unitPrice: 10,
  fromStock: true,
  ...over,
});

describe("status da OS", () => {
  it("concluída só volta pela reabertura", () => {
    for (const to of ["open", "scheduled", "in_progress", "canceled"] as const) {
      expect(canTransition("completed", to)).toBe(false);
    }
  });

  it("aberta pode ser agendada, iniciada ou cancelada", () => {
    expect(canTransition("open", "scheduled")).toBe(true);
    expect(canTransition("open", "in_progress")).toBe(true);
    expect(canTransition("open", "canceled")).toBe(true);
  });

  it("cancelada só reabre como aberta", () => {
    expect(canTransition("canceled", "open")).toBe(true);
    expect(canTransition("canceled", "in_progress")).toBe(false);
  });
});

describe("totais", () => {
  it("separa peças de mão de obra e arredonda em centavos", () => {
    const totals = computeOrderTotals([
      item({ quantity: 3, unitPrice: 0.1 }),
      item({ id: "i2", kind: "service", refId: "s1", quantity: 1.5, unitPrice: 120 }),
    ]);
    expect(totals).toEqual({ products: 0.3, services: 180, total: 180.3 });
  });
});

describe("baixa de estoque", () => {
  it("só produto do catálogo marcado para sair do estoque conta", () => {
    expect(
      stockConsumption([
        item({ quantity: 2 }),
        item({ id: "i2", quantity: 1 }),
        item({ id: "i3", refId: "p2", fromStock: false }),
        item({ id: "i4", refId: null }),
        item({ id: "i5", kind: "service", refId: "s1" }),
      ]),
    ).toEqual({ p1: 3 });
  });

  it("concluir de novo sem mudança não lança nada", () => {
    expect(stockDelta({ p1: 3 }, { p1: 3 })).toEqual({});
  });

  it("trocar a peça depois de reabrir lança só a diferença", () => {
    expect(stockDelta({ p1: 1, p2: 2 }, { p1: 3 })).toEqual({ p1: -2, p2: 2 });
  });

  it("cancelar devolve tudo o que saiu", () => {
    expect(stockDelta({}, { p1: 3, p2: 0.5 })).toEqual({ p1: -3, p2: -0.5 });
  });

  it("não acumula erro de ponto flutuante", () => {
    expect(stockDelta({ p1: 0.3 }, { p1: 0.1 })).toEqual({ p1: 0.2 });
  });
});

describe("assinatura", () => {
  it("o hash muda quando o conteúdo assinado muda", () => {
    const base = { code: "OS-0001", clientId: "c1", items: [item({})], report: "Troca do capacitor" };
    expect(signatureContentHash(base)).toBe(signatureContentHash({ ...base }));
    expect(signatureContentHash(base)).not.toBe(signatureContentHash({ ...base, report: "Outro" }));
    expect(signatureContentHash(base)).not.toBe(
      signatureContentHash({ ...base, items: [item({ quantity: 2 })] }),
    );
  });

  it("aceita só PNG de verdade", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(decodeSignatureDataUrl(`data:image/png;base64,${png.toString("base64")}`)).not.toBeNull();
    const fake = Buffer.from("<svg/>").toString("base64");
    expect(decodeSignatureDataUrl(`data:image/png;base64,${fake}`)).toBeNull();
    expect(decodeSignatureDataUrl(`data:image/jpeg;base64,${png.toString("base64")}`)).toBeNull();
  });

  it("concluir pede a assinatura OU o motivo, nunca os dois nem nenhum", () => {
    const signature = { name: "Ana Souza", imageDataUrl: "data:image/png;base64,AA==" };
    expect(CompleteServiceOrderSchema.safeParse({ signature }).success).toBe(true);
    expect(CompleteServiceOrderSchema.safeParse({ noSignatureReason: "Cliente ausente" }).success).toBe(true);
    expect(CompleteServiceOrderSchema.safeParse({}).success).toBe(false);
    expect(
      CompleteServiceOrderSchema.safeParse({ signature, noSignatureReason: "Cliente ausente" }).success,
    ).toBe(false);
  });

  it("recusa documento inválido e aceita vazio", () => {
    const base = { name: "Ana Souza", imageDataUrl: "data:image/png;base64,AA==" };
    expect(CompleteServiceOrderSchema.safeParse({ signature: { ...base, document: "123" } }).success).toBe(false);
    expect(CompleteServiceOrderSchema.safeParse({ signature: { ...base, document: "" } }).success).toBe(true);
  });
});

describe("edição", () => {
  it("o técnico não troca cliente, técnico nem agenda", () => {
    expect(ExecutionUpdateSchema.safeParse({ report: "ok" }).success).toBe(true);
    expect(ExecutionUpdateSchema.safeParse({ technicianId: "u2" }).success).toBe(false);
    expect(ExecutionUpdateSchema.safeParse({ clientId: "c2" }).success).toBe(false);
    expect(UpdateServiceOrderSchema.safeParse({ technicianId: "u2" }).success).toBe(true);
  });
});

it("código com quatro dígitos, sem cortar os maiores", () => {
  expect(formatOrderCode(7)).toBe("OS-0007");
  expect(formatOrderCode(12345)).toBe("OS-12345");
});
