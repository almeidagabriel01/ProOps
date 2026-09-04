/**
 * Nota de entrada → despesa.
 *
 * O risco aqui não é falhar, é **duplicar em silêncio**: quem compra costuma já
 * ter lançado a compra à mão quando pagou o fornecedor, e um segundo lançamento
 * não é um registro a mais — é o saldo da carteira errado.
 */

const getReceivedInvoice = jest.fn();
const createTransaction = jest.fn();
const update = jest.fn();
const get = jest.fn();

jest.mock("../../../init", () => ({
  db: {
    collection: () => ({
      doc: () => ({ update }),
      where: function () {
        return this;
      },
      limit: function () {
        return this;
      },
      get,
    }),
  },
}));
jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("./received-invoice.service", () => ({ getReceivedInvoice }));
jest.mock("../transaction.service", () => ({
  TransactionService: { createTransaction },
}));

import { createTransactionFromReceivedInvoice } from "./received-invoice-transaction.service";

const NOTA = {
  id: "t1_chave",
  tenantId: "t1",
  chaveAcesso: "1".repeat(44),
  versao: 1,
  status: "completa",
  emitenteCnpj: "11222333000181",
  emitenteNome: "Fornecedor Alfa",
  numero: "77",
  dataEmissao: "2026-09-01T10:00:00-03:00",
  valorTotal: 1500,
  createdAt: "",
  updatedAt: "",
};

/** Nenhuma despesa parecida no período. */
function semDuplicatas() {
  get.mockResolvedValue({ docs: [] });
}

function comDespesa(amount: number, description = "Material de obra") {
  get.mockResolvedValue({
    docs: [
      {
        id: "tx-existente",
        data: () => ({ amount, description, date: "2026-09-05" }),
      },
    ],
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  getReceivedInvoice.mockResolvedValue(NOTA);
  createTransaction.mockResolvedValue({ transactionId: "tx-novo", count: 1 });
  update.mockResolvedValue(undefined);
  semDuplicatas();
});

describe("createTransactionFromReceivedInvoice", () => {
  it("cria a despesa com os dados da nota", async () => {
    const result = await createTransactionFromReceivedInvoice(
      "t1",
      "1".repeat(44),
      "u1",
      {},
    );

    expect(result).toMatchObject({ outcome: "created", transactionId: "tx-novo" });
    expect(createTransaction.mock.calls[0][2]).toMatchObject({
      type: "expense",
      status: "pending",
      amount: 1500,
      // A data da nota, no fuso de Brasília — não a de hoje.
      date: "2026-09-01",
      clientName: "Fornecedor Alfa",
    });
  });

  it("grava o lançamento na nota, para não duplicar depois", async () => {
    await createTransactionFromReceivedInvoice("t1", "1".repeat(44), "u1", {});

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: "tx-novo" }),
    );
  });

  it("recusa lançar duas vezes a mesma nota", async () => {
    // Dois cliques seguidos, ou dois usuários na mesma tela.
    getReceivedInvoice.mockResolvedValue({ ...NOTA, transactionId: "tx-antigo" });

    const result = await createTransactionFromReceivedInvoice(
      "t1",
      "1".repeat(44),
      "u1",
      {},
    );

    expect(result).toEqual({ outcome: "already_launched", transactionId: "tx-antigo" });
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("avisa quando já existe despesa do mesmo valor no período", async () => {
    comDespesa(1500);

    const result = await createTransactionFromReceivedInvoice(
      "t1",
      "1".repeat(44),
      "u1",
      {},
    );

    expect(result.outcome).toBe("needs_confirmation");
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("aceita centavos de diferença como o mesmo valor", async () => {
    // Quem digita à mão arredonda; exigir igualdade exata não acharia o caso
    // mais comum de duplicata.
    comDespesa(1500.01);

    const result = await createTransactionFromReceivedInvoice(
      "t1",
      "1".repeat(44),
      "u1",
      {},
    );

    expect(result.outcome).toBe("needs_confirmation");
  });

  it("ignora despesa de valor claramente diferente", async () => {
    comDespesa(320);

    const result = await createTransactionFromReceivedInvoice(
      "t1",
      "1".repeat(44),
      "u1",
      {},
    );

    expect(result.outcome).toBe("created");
  });

  it("com `force`, cria mesmo havendo parecida — e sem nem consultar", async () => {
    comDespesa(1500);

    const result = await createTransactionFromReceivedInvoice(
      "t1",
      "1".repeat(44),
      "u1",
      {},
      { force: true },
    );

    expect(result.outcome).toBe("created");
    expect(get).not.toHaveBeenCalled();
  });

  it("recusa nota cancelada pelo fornecedor", async () => {
    // Documento sem validade não vira obrigação financeira.
    getReceivedInvoice.mockResolvedValue({ ...NOTA, status: "cancelada" });

    await expect(
      createTransactionFromReceivedInvoice("t1", "1".repeat(44), "u1", {}),
    ).rejects.toThrow("NOTA_CANCELADA_NAO_VIRA_DESPESA");
  });

  it("falha quando a nota não existe", async () => {
    getReceivedInvoice.mockResolvedValue(null);

    await expect(
      createTransactionFromReceivedInvoice("t1", "1".repeat(44), "u1", {}),
    ).rejects.toThrow("NOTA_RECEBIDA_NAO_ENCONTRADA");
  });

  it("usa o CNPJ quando o fornecedor veio sem nome no resumo", async () => {
    getReceivedInvoice.mockResolvedValue({ ...NOTA, emitenteNome: undefined });

    await createTransactionFromReceivedInvoice("t1", "1".repeat(44), "u1", {});

    expect(createTransaction.mock.calls[0][2].clientName).toBe("11222333000181");
  });

  it("passa carteira e categoria quando informadas", async () => {
    await createTransactionFromReceivedInvoice("t1", "1".repeat(44), "u1", {}, {
      wallet: "w1",
      category: "Materiais",
    });

    expect(createTransaction.mock.calls[0][2]).toMatchObject({
      wallet: "w1",
      category: "Materiais",
    });
  });

  it("omite carteira quando não escolhida, em vez de mandar vazio", async () => {
    await createTransactionFromReceivedInvoice("t1", "1".repeat(44), "u1", {});

    expect(createTransaction.mock.calls[0][2]).not.toHaveProperty("wallet");
  });
});
