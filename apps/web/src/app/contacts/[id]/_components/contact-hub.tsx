"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  FileText,
  Mail,
  MessageCircle,
  NotebookPen,
  Phone,
  Receipt,
  Trash2,
  Wallet,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useTenant } from "@/providers/tenant-provider";
import { usePagePermission } from "@/hooks/usePagePermission";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { ProposalService } from "@/services/proposal-service";
import { TransactionService, type Transaction } from "@/services/transaction-service";
import { FiscalService, type FiscalInvoice } from "@/services/fiscal-service";
import {
  KanbanService,
  getDefaultProposalColumns,
  type KanbanStatusColumn,
} from "@/services/kanban-service";
import { ClientNotesService, type ClientNote } from "@/services/client-notes-service";
import type { Client } from "@/services/client-service";
import type { Proposal } from "@/types/proposal";
import { isApprovedColumn } from "@/lib/proposal-approval";
import { buildWhatsAppShareHref } from "@/lib/send-link";
import { formatCurrency } from "@/utils/format";
import { formatDateBR } from "@/utils/date-format";
import { toast } from "@/lib/toast";
import { summarizeFinance, summarizeProposals } from "../../_lib/client-summary";

const LEGACY_STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  in_progress: "Em aberto",
  sent: "Enviada",
  approved: "Aprovada",
  rejected: "Recusada",
};

const TRANSACTION_STATUS_LABEL: Record<string, string> = {
  paid: "Pago",
  pending: "Pendente",
  overdue: "Atrasado",
};

const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  processing: "Processando",
  authorized: "Autorizada",
  rejected: "Rejeitada",
  cancelled: "Cancelada",
  error: "Erro",
};

const HUB_TABS = ["resumo", "propostas", "financeiro", "anotacoes", "dados"];

interface ContactHubProps {
  client: Client;
  /** O formulário de dados do contato (a página antiga). */
  dataTab: React.ReactNode;
}

type Loadable<T> = { loading: boolean; data: T };

/**
 * Ficha 360 do contato: resumo, propostas, financeiro, anotações e os dados.
 * Cada aba segue a permissão da tela dela e o plano (financeiro e notas só
 * com o módulo), então um membro sem acesso ao financeiro não vê valores de
 * lançamento pelo contato.
 */
export function ContactHub({ client, dataTab }: ContactHubProps) {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const { hasFinancial, hasFiscal } = usePlanLimits();
  const { canView: canViewProposals } = usePagePermission("proposals");
  const { canView: canViewTransactions } = usePagePermission("transactions");
  const { canView: canViewInvoices } = usePagePermission("invoices");
  const { canEdit: canEditClient } = usePagePermission("clients");

  const showFinance = hasFinancial && canViewTransactions;
  const showInvoices = hasFiscal && canViewInvoices;

  // `?aba=dados` abre direto no formulário (o "Editar" da lista usa isso).
  const searchParams = useSearchParams();
  const [tab, setTab] = React.useState(() => {
    const requested = searchParams.get("aba");
    return requested && HUB_TABS.includes(requested) ? requested : "resumo";
  });
  const [proposals, setProposals] = React.useState<Loadable<Proposal[]>>({ loading: true, data: [] });
  const [columns, setColumns] = React.useState<KanbanStatusColumn[]>([]);
  const [transactions, setTransactions] = React.useState<Loadable<Transaction[]>>({ loading: true, data: [] });
  const [invoices, setInvoices] = React.useState<Loadable<FiscalInvoice[]>>({ loading: true, data: [] });
  const [notes, setNotes] = React.useState<Loadable<ClientNote[]>>({ loading: true, data: [] });
  const [draft, setDraft] = React.useState("");
  const [savingNote, setSavingNote] = React.useState(false);
  const [noteToDelete, setNoteToDelete] = React.useState<ClientNote | null>(null);
  const [deletingNote, setDeletingNote] = React.useState(false);

  React.useEffect(() => {
    if (!tenantId) return;
    let active = true;

    if (canViewProposals) {
      Promise.all([
        ProposalService.getProposalsByClient(tenantId, client.id),
        KanbanService.getStatuses(tenantId).catch(() => [] as KanbanStatusColumn[]),
      ])
        .then(([list, cols]) => {
          if (!active) return;
          setProposals({ loading: false, data: list });
          setColumns(
            cols.length > 0
              ? cols
              : getDefaultProposalColumns().map(
                  (c, i) => ({ ...c, id: `default_${i}` }) as KanbanStatusColumn,
                ),
          );
        })
        .catch(() => active && setProposals({ loading: false, data: [] }));
    }

    if (showFinance) {
      TransactionService.getTransactionsByClient(tenantId, client.id)
        .then((list) => active && setTransactions({ loading: false, data: list }))
        .catch(() => active && setTransactions({ loading: false, data: [] }));
    }

    if (showInvoices) {
      FiscalService.listInvoices({ clientId: client.id })
        // Filtra de novo aqui: um backend anterior a `?clientId=` ignora o
        // parâmetro e devolve as notas da empresa inteira.
        .then(
          (res) =>
            active &&
            setInvoices({
              loading: false,
              data: res.invoices.filter((inv) => inv.clientId === client.id),
            }),
        )
        .catch(() => active && setInvoices({ loading: false, data: [] }));
    }

    ClientNotesService.list(client.id)
      .then((list) => active && setNotes({ loading: false, data: list }))
      .catch(() => active && setNotes({ loading: false, data: [] }));

    return () => {
      active = false;
    };
  }, [tenantId, client.id, canViewProposals, showFinance, showInvoices]);

  const findColumn = React.useCallback(
    (status: string) =>
      columns.find((c) => c.id === status) ?? columns.find((c) => c.mappedStatus === status),
    [columns],
  );
  const isApproved = React.useCallback(
    (p: Proposal) => p.status === "approved" || isApprovedColumn(findColumn(p.status)),
    [findColumn],
  );
  const statusLabel = (status: string) =>
    status === "draft"
      ? "Rascunho"
      : findColumn(status)?.label ?? LEGACY_STATUS_LABEL[status] ?? status;

  const proposalSummary = summarizeProposals(proposals.data, isApproved);
  const financeSummary = summarizeFinance(transactions.data);

  const saveNote = async () => {
    const text = draft.trim();
    if (!text) return;
    setSavingNote(true);
    try {
      const note = await ClientNotesService.create(client.id, text);
      setNotes((prev) => ({ loading: false, data: [note, ...prev.data] }));
      setDraft("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar a anotação.");
    } finally {
      setSavingNote(false);
    }
  };

  const deleteNote = async () => {
    if (!noteToDelete) return;
    setDeletingNote(true);
    try {
      await ClientNotesService.remove(client.id, noteToDelete.id);
      setNotes((prev) => ({
        loading: false,
        data: prev.data.filter((n) => n.id !== noteToDelete.id),
      }));
      setNoteToDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir a anotação.");
    } finally {
      setDeletingNote(false);
    }
  };

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="mb-4 w-full max-w-full justify-start overflow-x-auto md:w-auto">
        <TabsTrigger value="resumo">Resumo</TabsTrigger>
        {canViewProposals && <TabsTrigger value="propostas">Propostas</TabsTrigger>}
        {(showFinance || showInvoices) && (
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
        )}
        <TabsTrigger value="anotacoes">Anotações</TabsTrigger>
        <TabsTrigger value="dados">Dados</TabsTrigger>
      </TabsList>

      <TabsContent value="resumo" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Phone className="h-4 w-4" /> Contato
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {client.phone ? (
                <a
                  href={buildWhatsAppShareHref(client.phone, "")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:underline"
                >
                  <MessageCircle className="h-4 w-4 text-[#25D366]" />
                  {client.phone}
                </a>
              ) : (
                <p className="text-muted-foreground">Sem telefone</p>
              )}
              {client.email ? (
                <a href={`mailto:${client.email}`} className="flex items-center gap-2 break-all hover:underline">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {client.email}
                </a>
              ) : (
                <p className="text-muted-foreground">Sem e-mail</p>
              )}
            </CardContent>
          </Card>

          {canViewProposals && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <FileText className="h-4 w-4" /> Propostas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {proposals.loading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <div className="space-y-1 text-sm">
                    <p className="text-2xl font-semibold">{proposalSummary.total}</p>
                    <p className="text-muted-foreground">
                      {proposalSummary.approved} aprovada(s), {proposalSummary.open} em aberto
                    </p>
                    <p>Fechado: {formatCurrency(proposalSummary.approvedValue)}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {showFinance && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Wallet className="h-4 w-4" /> Financeiro
                </CardTitle>
              </CardHeader>
              <CardContent>
                {transactions.loading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <div className="space-y-1 text-sm">
                    <p>
                      Recebido:{" "}
                      <span className="font-semibold text-emerald-600">
                        {formatCurrency(financeSummary.received)}
                      </span>
                    </p>
                    <p>A receber: {formatCurrency(financeSummary.toReceive)}</p>
                    {financeSummary.overdue > 0 && (
                      <p className="text-destructive">
                        Vencido: {formatCurrency(financeSummary.overdue)}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <NotebookPen className="h-4 w-4" /> Últimas anotações
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setTab("anotacoes")}>
              Ver todas
            </Button>
          </CardHeader>
          <CardContent>
            {notes.loading ? (
              <Skeleton className="h-12 w-full" />
            ) : notes.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma anotação ainda.</p>
            ) : (
              <ul className="space-y-3">
                {notes.data.slice(0, 3).map((note) => (
                  <li key={note.id} className="text-sm">
                    <p className="whitespace-pre-wrap">{note.text}</p>
                    <p className="text-xs text-muted-foreground">
                      {note.authorName ?? "Equipe"} em {formatDateBR(note.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {canViewProposals && (
        <TabsContent value="propostas">
          {proposals.loading ? (
            <Skeleton className="h-40 w-full" />
          ) : proposals.data.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Nenhuma proposta para este contato"
              action={
                <Button asChild size="sm">
                  <Link href={`/proposals/new?clientId=${encodeURIComponent(client.id)}`}>Nova proposta</Link>
                </Button>
              }
            />
          ) : (
            <Card className="divide-y">
              {proposals.data.map((p) => (
                <Link
                  key={p.id}
                  href={`/proposals/${p.id}/view`}
                  className="flex flex-col gap-1 px-4 py-3 hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.title || "Proposta sem título"}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.createdAt ? formatDateBR(p.createdAt) : ""}
                      {p.proposalCode ? ` · ${p.proposalCode}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                      {statusLabel(p.status)}
                    </span>
                    <span className="font-medium">
                      {formatCurrency(
                        (p as { closedValue?: number | null }).closedValue ??
                          (p as { totalValue?: number }).totalValue ??
                          0,
                      )}
                    </span>
                  </div>
                </Link>
              ))}
            </Card>
          )}
        </TabsContent>
      )}

      {(showFinance || showInvoices) && (
        <TabsContent value="financeiro" className="space-y-6">
          {showFinance && (
            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Wallet className="h-4 w-4" /> Lançamentos
              </h3>
              {transactions.loading ? (
                <Skeleton className="h-32 w-full" />
              ) : transactions.data.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum lançamento deste contato.</p>
              ) : (
                <Card className="divide-y">
                  {transactions.data.map((t) => (
                    <Link
                      key={t.id}
                      href={`/transactions/${t.id}`}
                      className="flex flex-col gap-1 px-4 py-3 hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{t.description}</p>
                        <p className="text-xs text-muted-foreground">
                          Vencimento {formatDateBR(t.dueDate || t.date)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span
                          className={
                            t.status === "overdue"
                              ? "rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive"
                              : "rounded-full bg-muted px-2 py-0.5 text-xs"
                          }
                        >
                          {TRANSACTION_STATUS_LABEL[t.status] ?? t.status}
                        </span>
                        <span
                          className={
                            t.type === "expense" ? "font-medium text-rose-600" : "font-medium"
                          }
                        >
                          {t.type === "expense" ? "-" : ""}
                          {formatCurrency(t.amount)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </Card>
              )}
            </section>
          )}

          {showInvoices && (
            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Receipt className="h-4 w-4" /> Notas fiscais
              </h3>
              {invoices.loading ? (
                <Skeleton className="h-24 w-full" />
              ) : invoices.data.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma nota para este contato.</p>
              ) : (
                <Card className="divide-y">
                  {invoices.data.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium">
                          {invoice.type === "nfse" ? "NFS-e" : "NF-e"}
                          {invoice.numero ? ` nº ${invoice.numero}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateBR(invoice.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                          {INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status}
                        </span>
                        <span className="font-medium">{formatCurrency(invoice.valorTotal)}</span>
                      </div>
                    </div>
                  ))}
                </Card>
              )}
            </section>
          )}
        </TabsContent>
      )}

      <TabsContent value="anotacoes" className="space-y-4">
        {canEditClient && (
          <Card>
            <CardContent className="space-y-3 pt-6">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ligação, visita, preferência do cliente, próximo passo..."
                aria-label="Nova anotação"
                maxLength={2000}
                className="min-h-[90px]"
              />
              <div className="flex justify-end">
                <Button onClick={() => void saveNote()} disabled={!draft.trim() || savingNote}>
                  Salvar anotação
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {notes.loading ? (
          <Skeleton className="h-24 w-full" />
        ) : notes.data.length === 0 ? (
          <EmptyState
            icon={NotebookPen}
            title="Nenhuma anotação ainda"
            description="Registre ligações, visitas e combinados. A equipe inteira vê o histórico."
          />
        ) : (
          <ul className="space-y-3">
            {notes.data.map((note) => (
              <li key={note.id}>
                <Card>
                  <CardContent className="flex items-start justify-between gap-3 pt-4">
                    <div className="min-w-0">
                      <p className="whitespace-pre-wrap text-sm">{note.text}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {note.authorName ?? "Equipe"} em {formatDateBR(note.createdAt)}
                      </p>
                    </div>
                    {canEditClient && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Excluir anotação"
                        onClick={() => setNoteToDelete(note)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
        <ConfirmDialog
          open={noteToDelete !== null}
          onOpenChange={(open) => !open && !deletingNote && setNoteToDelete(null)}
          title="Excluir anotação"
          description="A anotação sai do histórico do contato."
          confirmLabel="Excluir"
          pendingLabel="Excluindo..."
          destructive
          isPending={deletingNote}
          onConfirm={deleteNote}
        />
      </TabsContent>

      <TabsContent value="dados">{dataTab}</TabsContent>
    </Tabs>
  );
}
