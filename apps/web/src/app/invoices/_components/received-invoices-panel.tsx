"use client";

import * as React from "react";
import Link from "next/link";
import { Boxes, Inbox, RefreshCw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { useSort } from "@/hooks/use-sort";
import { toast } from "@/lib/toast";
import { ManifestInvoiceDialog } from "@/components/features/fiscal/manifest-invoice-dialog";
import { ReceivedInvoiceItemsDialog } from "@/components/features/fiscal/received-invoice-items-dialog";
import { LaunchReceivedInvoiceButton } from "@/components/features/fiscal/launch-received-invoice-button";
import {
  ReceivedInvoiceService,
  type ReceivedInvoice,
} from "@/services/received-invoice-service";

/**
 * Notas de ENTRADA — as que os fornecedores emitiram contra o CNPJ do tenant.
 *
 * Vive como aba da mesma tela das emitidas porque são as duas metades do
 * módulo, mas o vocabulário é outro: aqui não há numeração nossa, nada é
 * assinado por nós e não existe cancelamento — só recepção, resposta e guarda.
 */

function formatarValor(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(iso: string | undefined): string {
  if (!iso) return "—";
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? "—" : data.toLocaleDateString("pt-BR");
}

/** CNPJ é o identificador quando o fornecedor não veio nomeado no resumo. */
function formatarCnpj(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return cnpj;
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

const MANIFESTACAO_LABEL: Record<string, string> = {
  ciencia: "Ciência dada",
  confirmacao: "Compra confirmada",
  desconhecimento: "Não reconhecida",
  nao_realizada: "Compra cancelada",
};

interface ReceivedInvoicesPanelProps {
  /** Quando falso, o módulo está desligado nas configurações fiscais. */
  enabled: boolean;
}

export function ReceivedInvoicesPanel({ enabled }: ReceivedInvoicesPanelProps) {
  const [invoices, setInvoices] = React.useState<ReceivedInvoice[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [manifesting, setManifesting] = React.useState<ReceivedInvoice | null>(null);
  const [viewingItems, setViewingItems] = React.useState<ReceivedInvoice | null>(null);

  const { items: sorted, requestSort, sortConfig } = useSort(invoices);

  const load = React.useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    try {
      const { invoices: list } = await ReceivedInvoiceService.list();
      setInvoices(list);
    } catch {
      // O acervo é secundário à emissão: falhar aqui não pode derrubar a tela
      // inteira, e o botão de buscar continua disponível.
      setInvoices([]);
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleSync() {
    setIsSyncing(true);
    try {
      const { applied } = await ReceivedInvoiceService.sync();
      await load();
      toast.success(
        applied > 0
          ? `${applied} ${applied === 1 ? "nota nova" : "notas novas"}.`
          : "Nenhuma nota nova.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Não foi possível buscar as notas agora.",
      );
    } finally {
      setIsSyncing(false);
    }
  }

  const replace = React.useCallback((updated: ReceivedInvoice) => {
    setInvoices((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item)),
    );
  }, []);

  const columns: DataTableColumn<ReceivedInvoice>[] = React.useMemo(
    () => [
      {
        key: "emitenteNome",
        header: "Fornecedor",
        priority: "primary",
        // 3 + 1 + 2 + 2 + 2 + 2 = 12. A soma TEM que fechar com o
        // `gridClassName` — estourando, a última coluna cai para a linha de
        // baixo e as ações somem do lugar onde a pessoa procura.
        className: "col-span-3",
        render: (invoice) => (
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">
              {invoice.emitenteNome || formatarCnpj(invoice.emitenteCnpj)}
            </span>
            {invoice.emitenteNome && (
              <span className="truncate text-xs text-muted-foreground">
                {formatarCnpj(invoice.emitenteCnpj)}
              </span>
            )}
          </div>
        ),
      },
      {
        key: "numero",
        header: "Nota",
        priority: "leading",
        className: "col-span-1",
        render: (invoice) => (
          <span className="text-sm">
            {invoice.numero ? `${invoice.numero}` : "—"}
            {invoice.serie ? `/${invoice.serie}` : ""}
          </span>
        ),
      },
      {
        key: "valorTotal",
        header: "Valor",
        priority: "primary",
        className: "col-span-2",
        render: (invoice) => (
          <span className="text-sm">{formatarValor(invoice.valorTotal)}</span>
        ),
      },
      {
        key: "dataEmissao",
        header: "Emitida em",
        priority: "secondary",
        className: "col-span-2",
        render: (invoice) => (
          <span className="text-sm text-muted-foreground">
            {formatarData(invoice.dataEmissao)}
          </span>
        ),
      },
      {
        key: "manifestacao",
        header: "Situação",
        priority: "primary",
        className: "col-span-2",
        render: (invoice) => {
          if (invoice.status === "cancelada") {
            return <Badge variant="destructive">Cancelada</Badge>;
          }
          // Sem resposta é o único estado que pede ação — e o único que
          // ganha destaque, para não competir com o que já está resolvido.
          if (!invoice.manifestacao) {
            return <Badge variant="secondary">Aguardando resposta</Badge>;
          }
          return (
            <span className="text-sm text-muted-foreground">
              {MANIFESTACAO_LABEL[invoice.manifestacao] ?? invoice.manifestacao}
            </span>
          );
        },
      },
      {
        key: "actions",
        header: "Ações",
        sortable: false,
        priority: "actions",
        className: "col-span-2 flex min-w-0 items-center justify-end gap-1",
        headerClassName: "flex justify-end",
        render: (invoice) => (
          <div className="flex items-center gap-1">
            {invoice.itens && invoice.itens.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Ver produtos e NCM"
                onClick={() => setViewingItems(invoice)}
              >
                <Boxes className="h-4 w-4" />
              </Button>
            )}
            {invoice.status !== "cancelada" && (
              <>
                <LaunchReceivedInvoiceButton
                  invoice={invoice}
                  onLaunched={replace}
                />
                <Button
                  variant={invoice.manifestacao ? "ghost" : "outline"}
                  size="sm"
                  className="h-8"
                  onClick={() => setManifesting(invoice)}
                >
                  {invoice.manifestacao ? "Rever" : "Responder"}
                </Button>
              </>
            )}
          </div>
        ),
      },
    ],
    [replace],
  );

  if (!enabled) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium">Recepção de notas desligada</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Ligando isto, as notas que seus fornecedores emitem contra o seu
              CNPJ aparecem aqui. Confirmando uma compra, você recebe os
              produtos com o NCM de cada um — que é o dado que falta ao
              cadastrar produto para emitir nota.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/settings/fiscal">
              <Settings className="mr-2 h-4 w-4" />
              Configuração fiscal
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Notas emitidas contra o seu CNPJ. Atualizam sozinhas de hora em hora.
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={isSyncing}
          onClick={() => void handleSync()}
        >
          {isSyncing ? (
            <Loader size="sm" variant="button" className="mr-2" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Buscar agora
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <Loader size="md" />
          </CardContent>
        </Card>
      ) : invoices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Nenhuma nota recebida ainda</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Assim que um fornecedor emitir uma nota contra o seu CNPJ, ela
              aparece aqui para você responder.
            </p>
          </CardContent>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          data={sorted}
          keyExtractor={(invoice) => invoice.id}
          sortConfig={sortConfig}
          onSort={requestSort}
          gridClassName="grid-cols-12"
        />
      )}

      <ManifestInvoiceDialog
        invoice={manifesting}
        onClose={() => setManifesting(null)}
        onManifested={replace}
      />

      <ReceivedInvoiceItemsDialog
        invoice={viewingItems}
        onClose={() => setViewingItems(null)}
      />
    </div>
  );
}
