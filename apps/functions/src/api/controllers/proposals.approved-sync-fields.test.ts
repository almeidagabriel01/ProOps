/**
 * Editar uma proposta APROVADA precisa ressincronizar os lancamentos.
 *
 * A decisao de ressincronizar sai de uma lista de nomes de campo. Um campo que
 * afete os lancamentos gerados e nao esteja nela falha do pior jeito possivel:
 * a proposta salva, a tela mostra o valor novo, o financeiro fica com o antigo,
 * e nao ha erro em lugar nenhum para investigar.
 *
 * Foi exatamente o que aconteceu com `commissions` quando o modulo de comissao
 * entrou: mudar o percentual do arquiteto numa proposta ja aprovada nao
 * reescrevia despesa nenhuma. Este guard amarra as listas ao que o construtor
 * de lancamentos de fato le do documento da proposta.
 */

jest.mock("../../init", () => ({ db: {}, auth: {}, adminApp: {} }));

import {
  APPROVED_SYNC_FIELDS,
  STRUCTURAL_APPROVED_SYNC_FIELDS,
} from "./proposals.controller";
import { buildApprovedProposalTransactionDrafts } from "./proposals.helpers";

/**
 * Campos do doc da proposta que `buildApprovedProposalTransactionDrafts` le
 * para montar receitas e comissoes. Mudar qualquer um deles muda o financeiro.
 */
const CAMPOS_QUE_MUDAM_LANCAMENTOS = [
  "title",
  "clientId",
  "clientName",
  "totalValue",
  "closedValue",
  "downPaymentEnabled",
  "downPaymentType",
  "downPaymentPercentage",
  "downPaymentValue",
  "downPaymentWallet",
  "downPaymentDueDate",
  "installmentsEnabled",
  "installmentsCount",
  "installmentsWallet",
  "firstInstallmentDate",
  "validUntil",
  "commissions",
];

describe("listas de ressincronizacao da proposta aprovada", () => {
  it.each(CAMPOS_QUE_MUDAM_LANCAMENTOS)(
    "%s dispara a ressincronizacao",
    (campo) => {
      expect(APPROVED_SYNC_FIELDS.has(campo)).toBe(true);
    },
  );

  it("commissions esta nas duas listas", () => {
    // Na primeira porque muda os lancamentos; na segunda porque muda VALOR, e
    // nao so rotulo: em `metadataOnly` o sync so mexeria na descricao.
    expect(APPROVED_SYNC_FIELDS.has("commissions")).toBe(true);
    expect(STRUCTURAL_APPROVED_SYNC_FIELDS.has("commissions")).toBe(true);
  });

  it("a lista estrutural nao promete mais do que a de disparo", () => {
    // Um campo estrutural fora da lista de disparo nunca seria avaliado.
    for (const campo of STRUCTURAL_APPROVED_SYNC_FIELDS) {
      expect(APPROVED_SYNC_FIELDS.has(campo)).toBe(true);
    }
  });
});

describe("mudar o percentual reescreve as despesas de comissao", () => {
  const base = {
    tenantId: "t1",
    clientId: "cli1",
    clientName: "Cliente",
    title: "Casa",
    totalValue: 100000,
    closedValue: null,
    downPaymentEnabled: false,
    installmentsEnabled: true,
    installmentsCount: 2,
    firstInstallmentDate: "2026-10-10",
  };

  const comissoes = (percentage: number) => [
    { contactId: "arq1", contactName: "Ana Souza", role: "arquiteto", percentage },
  ];

  function comissoesDe(percentage: number) {
    const { drafts } = buildApprovedProposalTransactionDrafts({
      proposalId: "p1",
      userId: "u1",
      defaultWalletName: "Caixa",
      proposalData: { ...base, commissions: comissoes(percentage) },
    });
    return drafts.filter((d) => d.isCommission);
  }

  it("10% vira 8% no mesmo numero de parcelas e nas mesmas chaves", () => {
    const antes = comissoesDe(10);
    const depois = comissoesDe(8);

    expect(antes.map((d) => d.amount)).toEqual([5000, 5000]);
    expect(depois.map((d) => d.amount)).toEqual([4000, 4000]);

    // As chaves nao mudam, entao o diff do sync ATUALIZA em vez de criar um
    // segundo conjunto de despesas ao lado do antigo.
    expect(depois.map((d) => d.commissionSourceKey)).toEqual(
      antes.map((d) => d.commissionSourceKey),
    );
    expect(depois.map((d) => d.installmentGroupId)).toEqual(
      antes.map((d) => d.installmentGroupId),
    );
  });

  it("remover o parceiro deixa o conjunto vazio, para o sync apagar", () => {
    const { drafts } = buildApprovedProposalTransactionDrafts({
      proposalId: "p1",
      userId: "u1",
      defaultWalletName: "Caixa",
      proposalData: { ...base, commissions: [] },
    });
    expect(drafts.filter((d) => d.isCommission)).toHaveLength(0);
    expect(drafts.filter((d) => d.type === "income")).toHaveLength(2);
  });
});
