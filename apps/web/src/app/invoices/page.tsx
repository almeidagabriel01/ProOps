"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Settings,
  XCircle,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  FiscalService,
  type FiscalInvoice,
  type FiscalInvoiceStatus,
  type FiscalSettings,
} from "@/services/fiscal-service";
import { TestModeBanner } from "@/components/features/fiscal/test-mode-banner";
import { CancelInvoiceButton } from "@/components/features/fiscal/cancel-invoice-button";
import { RejectionDetailButton } from "@/components/features/fiscal/rejection-detail-button";
import { useSort } from "@/hooks/use-sort";

const STATUS_META: Record<
  FiscalInvoiceStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  draft: { label: "Rascunho", icon: FileText, className: "bg-muted text-muted-foreground" },
  processing: {
    label: "Processando",
    icon: Clock,
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  authorized: {
    label: "Autorizada",
    icon: CheckCircle2,
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  rejected: {
    label: "Rejeitada",
    icon: XCircle,
    className: "bg-destructive/10 text-destructive",
  },
  cancelled: { label: "Cancelada", icon: XCircle, className: "bg-muted text-muted-foreground" },
  error: {
    label: "Erro",
    icon: AlertTriangle,
    className: "bg-destructive/10 text-destructive",
  },
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value || 0,
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function StatusBadge({ status }: { status: FiscalInvoiceStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.draft;
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = React.useState<FiscalInvoice[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [notConfigured, setNotConfigured] = React.useState(false);
  const [settings, setSettings] = React.useState<FiscalSettings | null>(null);
  const [refreshingId, setRefreshingId] = React.useState<string | null>(null);

  const refresh = React.useCallback(async (id: string) => {
    setRefreshingId(id);
    try {
      const { invoice } = await FiscalService.refreshInvoice(id);
      setInvoices((prev) => prev.map((item) => (item.id === id ? invoice : item)));
      if (invoice.status === "processing") {
        toast.info("A nota ainda está na fila do fisco.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Não foi possível consultar a nota.",
      );
    } finally {
      setRefreshingId(null);
    }
  }, []);

  const load = React.useCallback(async () => {
    try {
      const [{ invoices: data }, current] = await Promise.all([
        FiscalService.listInvoices({ limit: 100 }),
        // Falhar aqui não pode esconder as notas — o aviso de modo de teste é
        // importante, mas menos que a listagem em si.
        FiscalService.getSettings().catch(() => null),
      ]);
      setInvoices(data);
      setSettings(current);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("FISCAL_NAO_CONFIGURADO")) {
        setNotConfigured(true);
      } else {
        toast.error("Não foi possível carregar as notas fiscais.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const { items: sortedInvoices, requestSort, sortConfig } = useSort(invoices);

  const columns: DataTableColumn<FiscalInvoice>[] = React.useMemo(
    () => [
      {
        key: "numero",
        header: "Número",
        priority: "leading",
        // Sem `col-span` toda coluna ocupa 1/12 e o conteúdo é cortado. As
        // somas têm que fechar exatamente 12.
        className: "col-span-2",
        render: (invoice) => (
          <div className="flex flex-col">
            <span className="font-medium">
              {invoice.numero ? `${invoice.numero}${invoice.serie ? `/${invoice.serie}` : ""}` : "—"}
            </span>
            <span className="text-xs text-muted-foreground">
              {invoice.type === "nfe" ? "NF-e · produto" : "NFS-e · serviço"}
            </span>
          </div>
        ),
      },
      {
        key: "clientName",
        header: "Cliente",
        priority: "primary",
        className: "col-span-3",
        render: (invoice) => (
          <span className="block truncate">{invoice.clientName || "—"}</span>
        ),
      },
      {
        key: "valorTotal",
        header: "Valor",
        priority: "primary",
        // `text-right` precisa valer para o cabeçalho TAMBÉM, senão o rótulo
        // "Valor" fica à esquerda e o número à direita, desalinhados.
        className: "col-span-2 text-right",
        headerClassName: "text-right",
        render: (invoice) => (
          <span className="tabular-nums">{formatCurrency(invoice.valorTotal)}</span>
        ),
      },
      {
        key: "status",
        header: "Situação",
        priority: "primary",
        className: "col-span-2",
        render: (invoice) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={invoice.status} />
            {(invoice.status === "rejected" || invoice.status === "error") && (
              <RejectionDetailButton
                code={invoice.rejectionCode}
                message={invoice.rejectionMessage}
              />
            )}
          </div>
        ),
      },
      {
        key: "createdAt",
        header: "Emitida em",
        priority: "secondary",
        className: "col-span-2",
        render: (invoice) => (
          <span className="text-sm text-muted-foreground">{formatDate(invoice.createdAt)}</span>
        ),
      },
      {
        key: "actions",
        header: "",
        priority: "actions",
        sortable: false,
        className: "col-span-1 justify-self-end",
        render: (invoice) => {
          // pdfUrl e xmlUrl só existem depois de autorizada.
          if (invoice.status === "authorized") {
            return (
              <div className="flex items-center gap-1">
                {invoice.pdfUrl && (
                  <Button variant="ghost" size="sm" asChild>
                    <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4" />
                      <span className="ml-1.5">PDF</span>
                    </a>
                  </Button>
                )}
                {invoice.xmlUrl && (
                  <Button variant="ghost" size="sm" asChild>
                    <a href={invoice.xmlUrl} target="_blank" rel="noopener noreferrer">
                      XML
                    </a>
                  </Button>
                )}
                <CancelInvoiceButton
                  invoice={invoice}
                  onCancelled={(updated) =>
                    setInvoices((prev) =>
                      prev.map((item) => (item.id === updated.id ? updated : item)),
                    )
                  }
                />
              </div>
            );
          }

          if (invoice.status === "processing") {
            // O cron resolve sozinho em ate 15 min; o botao existe para quem
            // esta olhando a tela agora.
            return (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                disabled={refreshingId === invoice.id}
                onClick={() => void refresh(invoice.id)}
              >
                {refreshingId === invoice.id ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1 h-3 w-3" />
                )}
                Consultar agora
              </Button>
            );
          }

          // O motivo da rejeição vive na coluna "Situação", junto do selo —
          // texto de tamanho imprevisível não cabe numa célula de ações.
          return null;
        },
      },
    ],
    [refresh, refreshingId],
  );

  if (notConfigured) {
    return (
      <main className="mx-auto w-full max-w-5xl p-4 md:p-8">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <div>
              <h2 className="text-xl font-semibold">Emissão de notas ainda não configurada</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Cadastre os dados fiscais da sua empresa e envie o certificado digital para
                começar a emitir.
              </p>
            </div>
            <Button asChild>
              <Link href="/settings/fiscal">
                <Settings className="mr-2 h-4 w-4" />
                Configurar notas fiscais
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Notas Fiscais</h1>
          <p className="text-sm text-muted-foreground">
            Documentos emitidos pela sua empresa.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/settings/fiscal">
            <Settings className="mr-2 h-4 w-4" />
            Configuração fiscal
          </Link>
        </Button>
      </header>

      <TestModeBanner settings={settings} onChanged={setSettings} />

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : invoices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Nenhuma nota emitida ainda</p>
            <p className="text-sm text-muted-foreground">
              As notas aparecem aqui assim que forem emitidas a partir de um lançamento ou de
              uma proposta aprovada.
            </p>
          </CardContent>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          data={sortedInvoices}
          keyExtractor={(invoice) => invoice.id}
          sortConfig={sortConfig}
          onSort={requestSort}
          gridClassName="grid-cols-12"
          minWidth="900px"
        />
      )}

      {invoices.some((invoice) => invoice.status === "processing") && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          Notas em processamento são atualizadas automaticamente assim que o fisco responde.
        </p>
      )}
    </main>
  );
}
