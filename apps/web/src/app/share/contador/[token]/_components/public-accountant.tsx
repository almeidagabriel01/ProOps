"use client";

import * as React from "react";
import Image from "next/image";
import { AlertCircle, Calculator } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/ui/loader";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExportMenu } from "@/components/shared/export-menu";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";
import { formatDateBR } from "@/utils/date-format";
import { DATE_FORMAT, MONEY_FORMAT, downloadSheet, type SheetColumn, type SheetFormat } from "@/lib/export/sheet";
import { buildDreSheet } from "@/lib/finance/dre-export";
import { monthsInRange, periodChoices } from "@/lib/finance/dre-period";
import {
  EXAMPLE_ACCOUNTANT_TOKEN,
  EXAMPLE_INVOICES,
  EXAMPLE_OVERVIEW,
  EXAMPLE_RECEIVED,
  EXAMPLE_TRANSACTIONS,
  exampleDre,
} from "@/lib/accountant/example";
import { DreTable } from "@/app/dre/_components/dre-table";
import type { DreBasis, DreResult } from "@/services/finance-reports-service";
import {
  AccountantService,
  type AccountantInvoice,
  type AccountantOverview,
  type AccountantReceivedInvoice,
  type AccountantTransaction,
} from "@/services/accountant-service";

interface PublicAccountantProps {
  token: string;
}

type Range = { from: string; to: string };

const TX_STATUS = { paid: "Pago", pending: "A vencer", overdue: "Vencido" } as const;
const RECEIVED_STATUS = { completa: "Completa", resumo: "Resumo", cancelada: "Cancelada" } as const;

function toDate(value: string | null): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
}

/** Busca os dados de uma aba sempre que o período muda; no exemplo, usa o fixo. */
function useSection<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    load()
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Não foi possível carregar.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- as dependências vêm de quem chama
  }, deps);
  return { data, error, loading };
}

function SectionState({ loading, error, empty }: { loading: boolean; error: string | null; empty: boolean }) {
  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader size="md" />
      </div>
    );
  }
  if (error) return <p className="py-6 text-sm text-destructive">{error}</p>;
  if (empty) return <p className="py-6 text-sm text-muted-foreground">Nada neste período.</p>;
  return null;
}

function DreSection({ token, range, example }: { token: string; range: Range; example: boolean }) {
  const [basis, setBasis] = React.useState<DreBasis>("cash");
  const { data, error, loading } = useSection<DreResult>(
    () => (example ? Promise.resolve(exampleDre(monthsInRange(range.from, range.to))) : AccountantService.dre(token, { ...range, basis })),
    [token, range.from, range.to, basis, example],
  );
  const exportDre = async (format: SheetFormat) => {
    if (!data) return;
    await downloadSheet({
      format,
      fileName: `dre-${basis === "cash" ? "caixa" : "competencia"}-${range.from}-a-${range.to}`,
      sheetName: "DRE",
      ...buildDreSheet(data),
    });
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="Regime" className="inline-flex w-full rounded-xl border p-1 sm:w-auto">
          {(["cash", "accrual"] as const).map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={basis === b}
              onClick={() => setBasis(b)}
              className={cn(
                "flex-1 rounded-lg px-4 py-1.5 text-sm sm:flex-none",
                basis === b ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {b === "cash" ? "Caixa" : "Competência"}
            </button>
          ))}
        </div>
        <ExportMenu onExport={exportDre} disabled={!data || data.count === 0} />
      </div>
      <SectionState loading={loading} error={error} empty={Boolean(data && data.count === 0)} />
      {!loading && !error && data && data.count > 0 && <DreTable dre={data} />}
    </div>
  );
}

const TX_COLUMNS: SheetColumn<Record<string, string | number | Date | null>>[] = [
  { header: "Data", key: "data", width: 12, numFmt: DATE_FORMAT, kind: "date" },
  { header: "Descrição", key: "descricao", width: 36 },
  { header: "Tipo", key: "tipo", width: 10 },
  { header: "Status", key: "status", width: 10 },
  { header: "Vencimento", key: "vencimento", width: 12, numFmt: DATE_FORMAT, kind: "date" },
  { header: "Pago em", key: "pago", width: 12, numFmt: DATE_FORMAT, kind: "date" },
  { header: "Valor (R$)", key: "valor", width: 14, numFmt: MONEY_FORMAT, kind: "money" },
  { header: "Custos extras (R$)", key: "extras", width: 16, numFmt: MONEY_FORMAT, kind: "money" },
  { header: "Categoria", key: "categoria", width: 18 },
  { header: "Cliente / Fornecedor", key: "contato", width: 26 },
  { header: "Carteira", key: "carteira", width: 18 },
  { header: "Parcela", key: "parcela", width: 9 },
];

function TransactionsSection({ token, range, example }: { token: string; range: Range; example: boolean }) {
  const { data, error, loading } = useSection<{ transactions: AccountantTransaction[]; truncated: boolean }>(
    () => (example ? Promise.resolve({ transactions: EXAMPLE_TRANSACTIONS, truncated: false }) : AccountantService.transactions(token, range)),
    [token, range.from, range.to, example],
  );
  const rows = data?.transactions ?? [];
  const exportRows = async (format: SheetFormat) => {
    await downloadSheet({
      format,
      fileName: `lancamentos-${range.from}-a-${range.to}`,
      sheetName: "Lançamentos",
      columns: TX_COLUMNS,
      rows: rows.map((t) => ({
        data: toDate(t.date),
        descricao: t.description,
        tipo: t.type === "income" ? "Receita" : "Despesa",
        status: TX_STATUS[t.status],
        vencimento: toDate(t.dueDate),
        pago: toDate(t.paidAt),
        valor: t.type === "expense" ? -t.amount : t.amount,
        extras: t.type === "expense" ? -t.extraCosts : t.extraCosts,
        categoria: t.category ?? "",
        contato: t.contact ?? "",
        carteira: t.wallet ?? "",
        parcela: t.installment ?? "",
      })),
    });
  };
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportMenu onExport={exportRows} disabled={rows.length === 0} />
      </div>
      <SectionState loading={loading} error={error} empty={rows.length === 0} />
      {data?.truncated && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          O período tem lançamentos demais para uma consulta só. Escolha um período menor.
        </p>
      )}
      {!loading && !error && rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Data</th>
                <th className="px-3 py-2 text-left font-medium">Descrição</th>
                <th className="px-3 py-2 text-left font-medium">Categoria</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap px-3 py-2">{formatDateBR(t.date)}</td>
                  <td className="px-3 py-2">
                    <p>{t.description}</p>
                    {t.contact && <p className="text-xs text-muted-foreground">{t.contact}</p>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{t.category ?? "Sem categoria"}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {TX_STATUS[t.status]}
                    {t.paidAt && <span className="text-xs text-muted-foreground"> em {formatDateBR(t.paidAt)}</span>}
                  </td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-3 py-2 text-right tabular-nums",
                      t.type === "expense" && "text-rose-700 dark:text-rose-400",
                    )}
                  >
                    {formatCurrency(t.type === "expense" ? -(t.amount + t.extraCosts) : t.amount + t.extraCosts)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DocLink({ href, label, example }: { href: string; label: string; example: boolean }) {
  if (example) return <span className="text-muted-foreground">{label}</span>;
  return (
    <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  );
}

function InvoicesSection({ token, range, example }: { token: string; range: Range; example: boolean }) {
  const { data, error, loading } = useSection<{ invoices: AccountantInvoice[] }>(
    () => (example ? Promise.resolve({ invoices: EXAMPLE_INVOICES }) : AccountantService.invoices(token, range)),
    [token, range.from, range.to, example],
  );
  const rows = data?.invoices ?? [];
  const exportRows = async (format: SheetFormat) => {
    await downloadSheet({
      format,
      fileName: `notas-emitidas-${range.from}-a-${range.to}`,
      sheetName: "Notas emitidas",
      columns: [
        { header: "Tipo", key: "tipo", width: 8 },
        { header: "Número", key: "numero", width: 10 },
        { header: "Série", key: "serie", width: 8 },
        { header: "Situação", key: "situacao", width: 12 },
        { header: "Emitida em", key: "emitida", width: 12, numFmt: DATE_FORMAT, kind: "date" },
        { header: "Cancelada em", key: "cancelada", width: 12, numFmt: DATE_FORMAT, kind: "date" },
        { header: "Cliente", key: "cliente", width: 28 },
        { header: "Valor (R$)", key: "valor", width: 14, numFmt: MONEY_FORMAT, kind: "money" },
      ],
      rows: rows.map((n) => ({
        tipo: n.type === "nfse" ? "NFS-e" : "NF-e",
        numero: n.number ?? "",
        serie: n.series ?? "",
        situacao: n.status === "authorized" ? "Autorizada" : "Cancelada",
        emitida: toDate(n.issuedAt),
        cancelada: toDate(n.cancelledAt),
        cliente: n.contact ?? "",
        valor: n.amount,
      })),
    });
  };
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportMenu onExport={exportRows} disabled={rows.length === 0} />
      </div>
      <SectionState loading={loading} error={error} empty={rows.length === 0} />
      {!loading && !error && rows.length > 0 && (
        <ul className="divide-y rounded-xl border bg-card">
          {rows.map((n) => (
            <li key={n.id} className="flex flex-col gap-1 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">
                  {n.type === "nfse" ? "NFS-e" : "NF-e"} {n.number ?? ""}
                  {n.status === "cancelled" && (
                    <Badge variant="secondary" className="ml-2">
                      Cancelada
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateBR(n.issuedAt)}
                  {n.contact ? `, ${n.contact}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="tabular-nums">{formatCurrency(n.amount)}</span>
                {n.hasPdf && <DocLink href={AccountantService.documentUrl(token, "invoice", n.id, "pdf")} label="PDF" example={example} />}
                {n.hasXml && <DocLink href={AccountantService.documentUrl(token, "invoice", n.id, "xml")} label="XML" example={example} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReceivedSection({ token, range, example }: { token: string; range: Range; example: boolean }) {
  const { data, error, loading } = useSection<{ received: AccountantReceivedInvoice[] }>(
    () => (example ? Promise.resolve({ received: EXAMPLE_RECEIVED }) : AccountantService.received(token, range)),
    [token, range.from, range.to, example],
  );
  const rows = data?.received ?? [];
  const exportRows = async (format: SheetFormat) => {
    await downloadSheet({
      format,
      fileName: `notas-de-entrada-${range.from}-a-${range.to}`,
      sheetName: "Notas de entrada",
      columns: [
        { header: "Emitente", key: "emitente", width: 32 },
        { header: "CNPJ", key: "cnpj", width: 18 },
        { header: "Número", key: "numero", width: 10 },
        { header: "Série", key: "serie", width: 8 },
        { header: "Emissão", key: "emissao", width: 12, numFmt: DATE_FORMAT, kind: "date" },
        { header: "Situação", key: "situacao", width: 12 },
        { header: "Valor (R$)", key: "valor", width: 14, numFmt: MONEY_FORMAT, kind: "money" },
      ],
      rows: rows.map((r) => ({
        emitente: r.issuer,
        cnpj: r.issuerCnpj,
        numero: r.number ?? "",
        serie: r.series ?? "",
        emissao: toDate(r.issuedAt),
        situacao: RECEIVED_STATUS[r.status],
        valor: r.amount,
      })),
    });
  };
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportMenu onExport={exportRows} disabled={rows.length === 0} />
      </div>
      <SectionState loading={loading} error={error} empty={rows.length === 0} />
      {!loading && !error && rows.length > 0 && (
        <ul className="divide-y rounded-xl border bg-card">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-1 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">{r.issuer || r.issuerCnpj}</p>
                <p className="text-xs text-muted-foreground">
                  {r.number ? `Nº ${r.number}, ` : ""}
                  {formatDateBR(r.issuedAt)}, {RECEIVED_STATUS[r.status]}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="tabular-nums">{formatCurrency(r.amount)}</span>
                {r.hasXml && <DocLink href={AccountantService.documentUrl(token, "received", r.id, "xml")} label="XML" example={example} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * A página do contador: o financeiro da empresa em leitura, com o período que
 * ele escolher. `exemplo` é a versão fictícia da demonstração, sem API.
 */
export function PublicAccountant({ token }: PublicAccountantProps) {
  const example = token === EXAMPLE_ACCOUNTANT_TOKEN;
  const choices = React.useMemo(() => periodChoices(), []);
  const [choice, setChoice] = React.useState("last_month");
  const range = choices.find((c) => c.value === choice)?.range ?? choices[0].range;
  const overview = useSection<AccountantOverview>(
    () => (example ? Promise.resolve(EXAMPLE_OVERVIEW) : AccountantService.overview(token)),
    [token, example],
  );

  if (overview.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader size="lg" />
      </div>
    );
  }
  if (overview.error || !overview.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Link indisponível</AlertTitle>
          <AlertDescription>Este link não está disponível. Peça um novo à empresa.</AlertDescription>
        </Alert>
      </div>
    );
  }
  const { company, sections } = overview.data;

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8 md:py-12">
      <div className="mx-auto max-w-5xl space-y-6">
        {example && (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
            Este é um exemplo, com dados fictícios. Com o financeiro no plano, o contador recebe o link da sua empresa.
          </p>
        )}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {company.logoUrl ? (
              <Image
                src={company.logoUrl}
                alt={company.name}
                width={48}
                height={48}
                unoptimized
                className="h-12 w-12 rounded-lg object-contain"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Calculator className="h-6 w-6" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold">{company.name}</h1>
              <p className="text-sm text-muted-foreground">Financeiro para o contador, só leitura</p>
            </div>
          </div>
          <Select
            aria-label="Período"
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            disableSort
            className="sm:w-60"
          >
            {choices.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </header>

        <Tabs defaultValue="dre">
          <TabsList className="w-full max-w-full justify-start overflow-x-auto sm:w-auto">
            <TabsTrigger value="dre">DRE</TabsTrigger>
            <TabsTrigger value="transactions">Lançamentos</TabsTrigger>
            {sections.invoices && <TabsTrigger value="invoices">Notas emitidas</TabsTrigger>}
            {sections.received && <TabsTrigger value="received">Notas de entrada</TabsTrigger>}
          </TabsList>
          <TabsContent value="dre" className="mt-4">
            <DreSection token={token} range={range} example={example} />
          </TabsContent>
          <TabsContent value="transactions" className="mt-4">
            <TransactionsSection token={token} range={range} example={example} />
          </TabsContent>
          {sections.invoices && (
            <TabsContent value="invoices" className="mt-4">
              <InvoicesSection token={token} range={range} example={example} />
            </TabsContent>
          )}
          {sections.received && (
            <TabsContent value="received" className="mt-4">
              <ReceivedSection token={token} range={range} example={example} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
