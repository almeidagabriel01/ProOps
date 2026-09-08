jest.mock("../../init", () => ({
  db: {},
  auth: {},
  adminApp: {},
}));

import { buildApprovedProposalTransactionDrafts } from "./proposals.helpers";
import {
  sanitizeProposalCommissionsInput,
  splitCommissionAcrossSources,
} from "./proposal-commissions";

const BASE_PARAMS = {
  proposalId: "p1",
  userId: "user-1",
  defaultWalletName: "Caixa",
};

const ARQUITETO = {
  contactId: "arq1",
  contactName: "Ana Souza",
  role: "arquiteto" as const,
  percentage: 10,
};
const VENDEDOR = {
  contactId: "ven1",
  contactName: "Bruno Lima",
  role: "vendedor" as const,
  percentage: 2.5,
};

function makeProposalData(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    tenantId: "t1",
    clientId: "cli1",
    clientName: "Cliente Final",
    title: "Casa Alphaville",
    totalValue: 100000,
    closedValue: null,
    downPaymentEnabled: false,
    downPaymentType: "value",
    downPaymentValue: 0,
    downPaymentPercentage: 0,
    installmentsEnabled: false,
    installmentsCount: 0,
    installmentValue: 0,
    commissions: [ARQUITETO, VENDEDOR],
    ...overrides,
  };
}

function build(overrides: Record<string, unknown> = {}) {
  const { drafts } = buildApprovedProposalTransactionDrafts({
    ...BASE_PARAMS,
    proposalData: makeProposalData(overrides),
  });
  return {
    receitas: drafts.filter((d) => d.type === "income"),
    comissoes: drafts.filter((d) => d.isCommission),
  };
}

const soma = (values: { amount: number }[]) =>
  Math.round(values.reduce((sum, v) => sum + v.amount, 0) * 100) / 100;

describe("comissao espelha o cronograma do cliente", () => {
  // O caso literal que o cliente descreveu: 100k em 10x, arquiteto 10% e
  // vendedor 2,5%. Cada comissao dividida em 10, nas mesmas datas.
  test("100.000 em 10x gera 10 comissoes de cada parceiro nas datas das parcelas", () => {
    const { receitas, comissoes } = build({
      installmentsEnabled: true,
      installmentsCount: 10,
      firstInstallmentDate: "2026-10-10",
    });

    expect(receitas).toHaveLength(10);
    expect(comissoes).toHaveLength(20);

    const doArquiteto = comissoes.filter(
      (c) => c.commissionContactId === "arq1",
    );
    const doVendedor = comissoes.filter((c) => c.commissionContactId === "ven1");

    expect(doArquiteto).toHaveLength(10);
    expect(doVendedor).toHaveLength(10);
    expect(doArquiteto.every((c) => c.amount === 1000)).toBe(true);
    expect(doVendedor.every((c) => c.amount === 250)).toBe(true);
    expect(soma(doArquiteto)).toBe(10000);
    expect(soma(doVendedor)).toBe(2500);

    // Cada comissao vence junto da receita que ela espelha.
    receitas.forEach((receita, i) => {
      expect(doArquiteto[i].dueDate).toBe(receita.dueDate);
      expect(doArquiteto[i].date).toBe(receita.date);
    });
  });

  // 60% de sinal + 4x: a comissao NAO e dividida por 5 em partes iguais, e
  // proporcional ao que o cliente paga em cada momento.
  test("60% de sinal + 4x reparte a comissao na mesma proporcao", () => {
    const { receitas, comissoes } = build({
      downPaymentEnabled: true,
      downPaymentType: "percentage",
      downPaymentPercentage: 60,
      downPaymentDueDate: "2026-10-10",
      installmentsEnabled: true,
      installmentsCount: 4,
      firstInstallmentDate: "2026-11-10",
    });

    expect(receitas.map((r) => r.amount)).toEqual([
      60000, 10000, 10000, 10000, 10000,
    ]);

    const doArquiteto = comissoes.filter(
      (c) => c.commissionContactId === "arq1",
    );
    expect(doArquiteto.map((c) => c.amount)).toEqual([
      6000, 1000, 1000, 1000, 1000,
    ]);

    const doVendedor = comissoes.filter((c) => c.commissionContactId === "ven1");
    expect(doVendedor.map((c) => c.amount)).toEqual([1500, 250, 250, 250, 250]);

    // A comissao do sinal vence junto do sinal, nao 30 dias depois.
    expect(doArquiteto[0].dueDate).toBe("2026-10-10");
  });

  test("80% a vista e o saldo na entrega segue a mesma formula", () => {
    const { receitas, comissoes } = build({
      downPaymentEnabled: true,
      downPaymentType: "percentage",
      downPaymentPercentage: 80,
      downPaymentDueDate: "2026-10-10",
      validUntil: "2026-12-20",
    });

    expect(receitas.map((r) => r.amount)).toEqual([80000, 20000]);

    const doArquiteto = comissoes.filter(
      (c) => c.commissionContactId === "arq1",
    );
    expect(doArquiteto.map((c) => c.amount)).toEqual([8000, 2000]);
    expect(doArquiteto[1].dueDate).toBe("2026-12-20");
  });

  test("proposta a vista gera uma comissao unica por parceiro", () => {
    const { receitas, comissoes } = build();
    expect(receitas).toHaveLength(1);
    expect(comissoes).toHaveLength(2);
    expect(comissoes.map((c) => c.amount)).toEqual([10000, 2500]);
  });

  test("proposta sem comissao nao gera despesa nenhuma", () => {
    const { receitas, comissoes } = build({
      commissions: [],
      installmentsEnabled: true,
      installmentsCount: 3,
    });
    expect(receitas).toHaveLength(3);
    expect(comissoes).toHaveLength(0);
  });

  test("closedValue manda no calculo, nao o totalValue", () => {
    const { comissoes } = build({ closedValue: 80000 });
    const doArquiteto = comissoes.find((c) => c.commissionContactId === "arq1");
    expect(doArquiteto?.amount).toBe(8000);
  });
});

describe("formato do lancamento de comissao", () => {
  test("e despesa pendente, com o parceiro como contraparte", () => {
    const { comissoes } = build();
    const c = comissoes[0];

    expect(c.type).toBe("expense");
    expect(c.status).toBe("pending");
    expect(c.clientId).toBe("arq1");
    expect(c.clientName).toBe("Ana Souza");
    expect(c.commissionRole).toBe("arquiteto");
    expect(c.commissionPercentage).toBe(10);
    expect(c.wallet).toBe("Caixa");
    expect(c.category).toBe("Comissao");
  });

  test("nasce pendente mesmo quando a receita nasce paga", () => {
    const { drafts } = buildApprovedProposalTransactionDrafts({
      ...BASE_PARAMS,
      proposalData: makeProposalData(),
      initialStatus: "paid",
    });

    expect(drafts.filter((d) => d.type === "income")[0].status).toBe("paid");
    expect(drafts.filter((d) => d.isCommission)[0].status).toBe("pending");
  });

  // Com proposalGroupId, a comissao entraria no doc-resumo dos recebiveis e a
  // aba Agrupados somaria receita com despesa no mesmo card.
  test("nao entra no grupo da proposta, e sim num grupo por parceiro", () => {
    const { comissoes } = build({
      installmentsEnabled: true,
      installmentsCount: 2,
    });

    expect(comissoes.every((c) => c.proposalGroupId === null)).toBe(true);
    expect(comissoes[0].installmentGroupId).toBe("commission_p1_arq1_arquiteto");
    expect(
      comissoes.find((c) => c.commissionContactId === "ven1")
        ?.installmentGroupId,
    ).toBe("commission_p1_ven1_vendedor");
  });

  // O sync casa desejado com existente por chave. Chave repetida faria uma
  // comissao sobrescrever a outra, ou a parcela de receita de mesmo numero.
  test("cada comissao tem chave propria, sem colidir com as receitas", () => {
    const { drafts } = buildApprovedProposalTransactionDrafts({
      ...BASE_PARAMS,
      proposalData: makeProposalData({
        installmentsEnabled: true,
        installmentsCount: 3,
      }),
    });

    const keys = drafts.map((d) =>
      d.isCommission
        ? `commission_${d.commissionContactId}_${d.commissionRole}_${d.commissionSourceKey}`
        : d.isDownPayment
          ? "down_payment"
          : d.isInstallment
            ? `installment_${d.installmentNumber}`
            : "single",
    );

    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("splitCommissionAcrossSources", () => {
  const source = (amount: number) => ({
    sourceKey: `installment_${amount}`,
    amount,
    date: "2026-01-01",
    dueDate: "2026-01-01",
    installmentCount: null,
    installmentNumber: null,
  });

  // Sem o resto na ultima parcela o parceiro perderia centavos para sempre,
  // sem que nada acusasse.
  test("o resto do arredondamento fecha na ultima parcela", () => {
    const parts = splitCommissionAcrossSources(1000.01, [
      source(1000),
      source(1000),
      source(1000),
    ]);
    expect(soma(parts.map((amount) => ({ amount })))).toBe(1000.01);
  });

  test("valor que nao divide igual continua somando o total", () => {
    const parts = splitCommissionAcrossSources(100, [
      source(1),
      source(1),
      source(1),
    ]);
    expect(soma(parts.map((amount) => ({ amount })))).toBe(100);
  });

  test("sem receita nenhuma nao reparte nada", () => {
    expect(splitCommissionAcrossSources(100, [])).toEqual([]);
  });
});

describe("sanitizeProposalCommissionsInput", () => {
  test("recusa percentual fora de 0..100 em vez de clampar", () => {
    expect(
      sanitizeProposalCommissionsInput([{ ...ARQUITETO, percentage: 150 }]),
    ).toEqual([]);
    expect(
      sanitizeProposalCommissionsInput([{ ...ARQUITETO, percentage: 0 }]),
    ).toEqual([]);
    expect(
      sanitizeProposalCommissionsInput([{ ...ARQUITETO, percentage: -5 }]),
    ).toEqual([]);
  });

  test("recusa papel que nao seja vendedor ou arquiteto", () => {
    expect(
      sanitizeProposalCommissionsInput([{ ...ARQUITETO, role: "cliente" }]),
    ).toEqual([]);
  });

  test("recusa entrada sem contato", () => {
    expect(
      sanitizeProposalCommissionsInput([{ ...ARQUITETO, contactId: "" }]),
    ).toEqual([]);
  });

  test("descarta a dupla contato+papel repetida, que dobraria a comissao", () => {
    const out = sanitizeProposalCommissionsInput([
      ARQUITETO,
      { ...ARQUITETO, percentage: 5 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].percentage).toBe(10);
  });

  test("o mesmo contato pode ser vendedor e arquiteto", () => {
    const out = sanitizeProposalCommissionsInput([
      { ...ARQUITETO, contactId: "x" },
      { ...VENDEDOR, contactId: "x" },
    ]);
    expect(out).toHaveLength(2);
  });

  test("entrada que nao e array vira lista vazia", () => {
    expect(sanitizeProposalCommissionsInput(undefined)).toEqual([]);
    expect(sanitizeProposalCommissionsInput("10%")).toEqual([]);
    expect(sanitizeProposalCommissionsInput([null, 3])).toEqual([]);
  });
});
