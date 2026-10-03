"use client";

import * as React from "react";
import Image from "next/image";
import { CreditCard, FileSignature, FileText, FolderKanban, Hammer, UserRound, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { formatCurrency } from "@/utils/format";
import { formatDateBR } from "@/utils/date-format";
import { formatStageSchedule } from "@/lib/projects/stage-schedule";
import { formatWhen } from "@/lib/field-service/service-orders";
import { brandButtonStyle } from "@/utils/color-utils";
import type { PortalItemKind, PortalView } from "@/services/client-portal-service";

interface ClientPortalViewProps {
  view: PortalView;
  /** Abre a página do item (proposta, lançamento, obra). */
  onOpen: (kind: PortalItemKind, id: string) => Promise<void>;
  /** Portal de exemplo da demonstração: aviso no topo e documentos sem link. */
  example?: boolean;
}

const PROPOSAL_STATE = {
  approved: { label: "Aprovada", variant: "success" },
  rejected: { label: "Recusada", variant: "secondary" },
  open: { label: "Em análise", variant: "warning" },
} as const;

const PAYMENT_STATUS = {
  paid: { label: "Pago", variant: "success" },
  pending: { label: "A vencer", variant: "secondary" },
  overdue: { label: "Vencida", variant: "destructive" },
} as const;

function Section({ icon: Icon, title, children }: { icon: typeof FileText; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">{children}</ul>
      </CardContent>
    </Card>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">{children}</li>;
}

/**
 * O portal do cliente: tudo o que é dele com a empresa, numa página. Cada item
 * abre a página pública que já existe (proposta, cobrança, obra), e é lá que
 * ele aceita, paga ou confirma a entrega.
 */
export function ClientPortalView({ view, onOpen, example = false }: ClientPortalViewProps) {
  const [opening, setOpening] = React.useState<string | null>(null);
  const brand = brandButtonStyle(view.company.primaryColor);
  const serviceOrders = view.serviceOrders ?? [];
  const contracts = view.contracts ?? [];
  const nothing =
    view.proposals.length +
      view.payments.length +
      view.projects.length +
      view.invoices.length +
      serviceOrders.length +
      contracts.length ===
    0;
  const openCount = view.payments.filter((p) => p.status !== "paid").length;

  const open = async (kind: PortalItemKind, id: string) => {
    setOpening(`${kind}:${id}`);
    try {
      await onOpen(kind, id);
    } finally {
      setOpening(null);
    }
  };

  const action = (kind: PortalItemKind, id: string, label: string, primary = false) => (
    <Button
      size="sm"
      variant={primary ? "default" : "outline"}
      className="w-full shrink-0 sm:w-auto"
      style={primary ? brand : undefined}
      disabled={opening !== null}
      onClick={() => void open(kind, id)}
    >
      {opening === `${kind}:${id}` && <Loader size="sm" variant="button" className="mr-2" />}
      {label}
    </Button>
  );

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8 md:py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        {example && (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
            Este é um portal de exemplo, com dados fictícios. Com o plano Pro, cada cliente recebe o link do dele.
          </p>
        )}

        <header className="flex items-center gap-3">
          {view.company.logoUrl ? (
            <Image
              src={view.company.logoUrl}
              alt={view.company.name}
              width={48}
              height={48}
              unoptimized
              className="h-12 w-12 rounded-lg object-contain"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserRound className="h-6 w-6" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">
              {view.client.firstName ? `Olá, ${view.client.firstName}` : "Olá"}
            </h1>
            <p className="text-sm text-muted-foreground">Seu portal com a {view.company.name}</p>
          </div>
        </header>

        {openCount > 0 && (
          <p className="text-sm text-muted-foreground">
            {openCount === 1 ? "Você tem 1 pagamento em aberto." : `Você tem ${openCount} pagamentos em aberto.`}
          </p>
        )}

        {nothing && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Ainda não há nada aqui. Assim que a {view.company.name} mandar uma proposta, ela aparece nesta página.
            </CardContent>
          </Card>
        )}

        {view.proposals.length > 0 && (
          <Section icon={FileText} title="Propostas">
            {view.proposals.map((p) => (
              <Row key={p.id}>
                <div className="min-w-0">
                  <p className="font-medium">{p.title}</p>
                  <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant={PROPOSAL_STATE[p.state].variant}>{PROPOSAL_STATE[p.state].label}</Badge>
                    <span>{formatCurrency(p.value)}</span>
                    {p.code && <span>{p.code}</span>}
                    {p.state === "open" && p.validUntil && <span>válida até {formatDateBR(p.validUntil)}</span>}
                  </p>
                </div>
                {action("proposal", p.id, p.state === "open" ? "Ver e responder" : "Ver proposta", p.state === "open")}
              </Row>
            ))}
          </Section>
        )}

        {view.payments.length > 0 && (
          <Section icon={CreditCard} title="Pagamentos">
            {view.payments.map((p) => {
              const payable = p.status !== "paid" && view.canPayOnline;
              return (
                <Row key={p.id}>
                  <div className="min-w-0">
                    <p className="font-medium">{p.description}</p>
                    <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant={PAYMENT_STATUS[p.status].variant}>{PAYMENT_STATUS[p.status].label}</Badge>
                      <span>{formatCurrency(p.amount)}</span>
                      {p.dueDate && (
                        <span>
                          {p.status === "overdue" ? "venceu em" : p.status === "pending" ? "vence em" : "vencimento"}{" "}
                          {formatDateBR(p.dueDate)}
                        </span>
                      )}
                    </p>
                  </div>
                  {action("payment", p.id, payable ? "Pagar" : p.status === "paid" ? "Ver recibo" : "Ver cobrança", payable)}
                </Row>
              );
            })}
          </Section>
        )}

        {view.projects.length > 0 && (
          <Section icon={Hammer} title="Obra">
            {view.projects.map((p) => (
              <Row key={p.id}>
                <div className="min-w-0">
                  <p className="font-medium">{p.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {p.deliveryAccepted
                      ? "Entrega aceita"
                      : p.status === "completed"
                        ? "Concluída"
                        : p.stagesTotal > 0
                          ? `Em andamento: ${p.stagesDone} de ${p.stagesTotal} etapas`
                          : "Em andamento"}
                  </p>
                  {p.stagesTotal > 0 && (
                    <div
                      className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-label={`Etapas concluídas de ${p.title}`}
                      aria-valuemin={0}
                      aria-valuemax={p.stagesTotal}
                      aria-valuenow={p.stagesDone}
                    >
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.round((p.stagesDone / p.stagesTotal) * 100)}%` }}
                      />
                    </div>
                  )}
                  {p.nextVisit && (
                    <p className="mt-2 text-sm">
                      <span className="text-muted-foreground">Próxima visita ({p.nextVisit.stageName}): </span>
                      <span className="font-medium">{formatStageSchedule(p.nextVisit)}</span>
                    </p>
                  )}
                </div>
                {action("project", p.id, "Acompanhar")}
              </Row>
            ))}
          </Section>
        )}

        {contracts.length > 0 && (
          <Section icon={FileSignature} title="Contratos">
            {contracts.map((c) => (
              <Row key={c.id}>
                <div className="min-w-0">
                  <p className="font-medium">{c.title}</p>
                  <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>
                      {formatCurrency(c.monthlyAmount)} por mês, vence todo dia {c.billingDay}
                    </span>
                    <span>{c.code}</span>
                  </p>
                  {c.nextVisitDate && (
                    <p className="mt-1 text-sm">
                      <span className="text-muted-foreground">Próxima visita: </span>
                      <span className="font-medium">{formatDateBR(c.nextVisitDate)}</span>
                    </p>
                  )}
                </div>
                {c.isPmoc && action("pmoc", c.id, "Ver o PMOC")}
              </Row>
            ))}
          </Section>
        )}

        {serviceOrders.length > 0 && (
          <Section icon={Wrench} title="Atendimentos">
            {serviceOrders.map((o) => (
              <Row key={o.id}>
                <div className="min-w-0">
                  <p className="font-medium">{o.title}</p>
                  <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant={o.state === "completed" ? "success" : "secondary"}>
                      {o.state === "completed" ? "Concluído" : "Agendado"}
                    </Badge>
                    <span>{o.code}</span>
                    {o.date && (
                      <span>
                        {o.state === "completed" ? `em ${formatDateBR(o.date)}` : formatWhen(o.date)}
                      </span>
                    )}
                    {o.technicianName && <span>com {o.technicianName}</span>}
                  </p>
                </div>
                {o.state === "completed" && action("service_order", o.id, o.signed ? "Ver comprovante" : "Ver atendimento")}
              </Row>
            ))}
          </Section>
        )}

        {view.invoices.length > 0 && (
          <Section icon={FolderKanban} title="Notas fiscais">
            {view.invoices.map((n) => (
              <Row key={n.id}>
                <div className="min-w-0">
                  <p className="font-medium">
                    {n.type === "nfse" ? "NFS-e" : "NF-e"}
                    {n.number ? ` ${n.number}` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(n.amount)}
                    {n.issuedAt ? `, emitida em ${formatDateBR(n.issuedAt)}` : ""}
                  </p>
                </div>
                {n.pdfUrl ? (
                  <Button size="sm" variant="outline" className="w-full shrink-0 sm:w-auto" asChild>
                    <a href={n.pdfUrl} target="_blank" rel="noopener noreferrer">
                      Baixar PDF
                    </a>
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="w-full shrink-0 sm:w-auto" disabled>
                    Baixar PDF
                  </Button>
                )}
              </Row>
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}
