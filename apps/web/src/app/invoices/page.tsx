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
} from "@/services/fiscal-service";
import { humanizeRejection } from "@/lib/fiscal/rejection-messages";

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

  const load = React.useCallback(async () => {
    try {
      const { invoices: data } = await FiscalService.listInvoices({ limit: 100 });
      setInvoices(data);
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

  const columns: DataTableColumn<FiscalInvoice>[] = React.useMemo(
    () => [
      {
        key: "numero",
        header: "Número",
        priority: "leading",
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
        render: (invoice) => invoice.clientName || "—",
      },
      {
        key: "valorTotal",
        header: "Valor",
        priority: "primary",
        className: "text-right",
        render: (invoice) => (
          <span className="tabular-nums">{formatCurrency(invoice.valorTotal)}</span>
        ),
      },
      {
        key: "status",
        header: "Situação",
        priority: "primary",
        render: (invoice) => <StatusBadge status={invoice.status} />,
      },
      {
        key: "createdAt",
        header: "Emitida em",
        priority: "secondary",
        render: (invoice) => (
          <span className="text-sm text-muted-foreground">{formatDate(invoice.createdAt)}</span>
        ),
      },
      {
        key: "actions",
        header: "",
        priority: "actions",
        sortable: false,
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
              </div>
            );
          }

          if (invoice.status === "rejected" || invoice.status === "error") {
            const humanized = humanizeRejection(
              invoice.rejectionCode,
              invoice.rejectionMessage,
            );
            return (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-destructive">
                  {humanized.titulo}
                </span>
                {humanized.explicacao && (
                  <span className="text-xs text-muted-foreground">
                    {humanized.explicacao}
                  </span>
                )}
                {/* A mensagem crua do provedor fica visível, não escondida num
                    tooltip: é ela que o contador do cliente pede, e é ela que
                    permite pesquisar o erro. Fica truncada para não dominar a
                    linha, e inteira no title. */}
                {humanized.original && (
                  <span
                    className="line-clamp-2 font-mono text-[11px] leading-tight text-muted-foreground/80"
                    title={humanized.original}
                  >
                    {humanized.original}
                  </span>
                )}
              </div>
            );
          }

          return null;
        },
      },
    ],
    [],
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
          data={invoices}
          keyExtractor={(invoice) => invoice.id}
          gridClassName="grid-cols-6"
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
