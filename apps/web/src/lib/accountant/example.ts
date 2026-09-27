import type { DreResult } from "@/services/finance-reports-service";
import type {
  AccountantInvoice,
  AccountantOverview,
  AccountantReceivedInvoice,
  AccountantTransaction,
} from "@/services/accountant-service";

/**
 * O link do contador de exemplo, aberto em `/share/contador/exemplo` pela
 * conta de demonstração. Dado fixo no front, sem API e sem link real; o mesmo
 * conteúdo em qualquer período escolhido.
 */
export const EXAMPLE_ACCOUNTANT_TOKEN = "exemplo";

export const EXAMPLE_OVERVIEW: AccountantOverview = {
  company: { name: "Sua empresa", logoUrl: null, primaryColor: null },
  sections: { dre: true, transactions: true, invoices: true, received: true },
};

const line = (name: string, total: number) => ({ name, byMonth: {}, total });
const block = (group: string, label: string, total: number, categories: ReturnType<typeof line>[]) => ({
  group,
  label,
  byMonth: {},
  total,
  categories,
});

export function exampleDre(months: string[]): DreResult {
  const spread = (total: number) => Object.fromEntries(months.map((m) => [m, Math.round((total / months.length) * 100) / 100]));
  const withMonths = <T extends { total: number }>(x: T) => ({ ...x, byMonth: spread(x.total) });
  const groups = {
    revenue: withMonths(block("revenue", "Receita bruta", 48000, [withMonths(line("Propostas", 42000)), withMonths(line("Manutenção", 6000))])),
    other_income: withMonths(block("other_income", "Outras receitas", 0, [])),
    deduction: withMonths(block("deduction", "Impostos e deduções", 2880, [withMonths(line("Impostos", 2880))])),
    cost: withMonths(block("cost", "Custos", 17500, [withMonths(line("Materiais", 14000)), withMonths(line("Mão de obra", 3500))])),
    operating: withMonths(block("operating", "Despesas operacionais", 9100, [withMonths(line("Aluguel", 4800)), withMonths(line("Marketing", 1800)), withMonths(line("Comissao", 2500))])),
    other_expense: withMonths(block("other_expense", "Outras despesas", 320, [withMonths(line("Taxas bancárias", 320))])),
  } as unknown as DreResult["groups"];
  const total = (v: number) => ({ byMonth: spread(v), total: v });
  return {
    basis: "cash",
    months,
    groups,
    totals: {
      netRevenue: total(45120),
      grossProfit: total(27620),
      operatingResult: total(18520),
      result: total(18200),
    },
    count: 9,
    truncated: false,
  };
}

export const EXAMPLE_TRANSACTIONS: AccountantTransaction[] = [
  { id: "e1", description: "Automação da sala: entrada", type: "income", status: "paid", date: "2026-08-04", dueDate: "2026-08-04", paidAt: "2026-08-04", amount: 18000, extraCosts: 0, category: "Propostas", contact: "Ana Ribeiro", wallet: "Conta Principal", installment: null },
  { id: "e2", description: "Automação da sala: parcela", type: "income", status: "pending", date: "2026-08-04", dueDate: "2026-09-04", paidAt: null, amount: 12000, extraCosts: 0, category: "Propostas", contact: "Ana Ribeiro", wallet: "Conta Principal", installment: "2/3" },
  { id: "e3", description: "Contrato de manutenção", type: "income", status: "paid", date: "2026-08-10", dueDate: "2026-08-10", paidAt: "2026-08-10", amount: 6000, extraCosts: 0, category: "Manutenção", contact: "Condomínio Jardins", wallet: "Conta Principal", installment: null },
  { id: "e4", description: "Compra de módulos", type: "expense", status: "paid", date: "2026-08-06", dueDate: "2026-08-06", paidAt: "2026-08-06", amount: 14000, extraCosts: 350, category: "Materiais", contact: "Distribuidora Sul", wallet: "Conta Principal", installment: null },
  { id: "e5", description: "Aluguel", type: "expense", status: "paid", date: "2026-08-05", dueDate: "2026-08-05", paidAt: "2026-08-05", amount: 4800, extraCosts: 0, category: "Aluguel", contact: null, wallet: "Conta Principal", installment: null },
  { id: "e6", description: "Simples Nacional", type: "expense", status: "pending", date: "2026-08-20", dueDate: "2026-08-20", paidAt: null, amount: 2880, extraCosts: 0, category: "Impostos", contact: null, wallet: "Conta Principal", installment: null },
];

export const EXAMPLE_INVOICES: AccountantInvoice[] = [
  { id: "n1", type: "nfse", number: "58", series: "1", status: "authorized", amount: 18000, contact: "Ana Ribeiro", issuedAt: "2026-08-04", cancelledAt: null, hasPdf: true, hasXml: true },
  { id: "n2", type: "nfe", number: "212", series: "1", status: "authorized", amount: 6000, contact: "Condomínio Jardins", issuedAt: "2026-08-10", cancelledAt: null, hasPdf: true, hasXml: true },
  { id: "n3", type: "nfse", number: "59", series: "1", status: "cancelled", amount: 900, contact: "Bruno Carvalho", issuedAt: "2026-08-12", cancelledAt: "2026-08-13", hasPdf: true, hasXml: true },
];

export const EXAMPLE_RECEIVED: AccountantReceivedInvoice[] = [
  { id: "r1", issuer: "Distribuidora Sul Ltda", issuerCnpj: "12345678000190", number: "4410", series: "1", issuedAt: "2026-08-06", amount: 14350, status: "completa", hasXml: true },
];
