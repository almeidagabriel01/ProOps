"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  FileSignature,
  Link2,
  Pause,
  Pencil,
  Play,
  Power,
  Receipt,
  Trash2,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { useTenant } from "@/providers/tenant-provider";
import { useAuth } from "@/providers/auth-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { usePagePermission } from "@/hooks/usePagePermission";
import { useServiceOrderScope } from "@/hooks/useServiceOrders";
import { toast } from "@/lib/toast";
import { formatCurrency } from "@/utils/format";
import {
  CHARGE_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
  VISIT_INTERVAL_OPTIONS,
  formatDay,
  nextStepLabel,
} from "@/lib/field-service/contracts";
import { formatWhen } from "@/lib/field-service/service-orders";
import { FieldService } from "@/services/field-service-service";
import { SharedTransactionService } from "@/services/shared-transaction-service";
import type { ContractCharge, ServiceContract, ServiceOrder } from "@/types/field-service";
import { ServiceOrdersSkeleton } from "../../service-orders/_components/service-orders-skeleton";
import { ServiceOrderStatusBadge } from "../../service-orders/_components/status-badge";
import { ContractStatusBadge } from "../_components/contract-status-badge";
import { ActivateContractDialog } from "../_components/activate-contract-dialog";
import { PmocCard } from "../_components/pmoc-card";
import { Loader } from "@/components/ui/loader";

/** O contrato: o que se cobra, o que já foi cobrado e as visitas que ele abriu. */
export default function ContractDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { tenant, isReadOnly } = useTenant();
  const { user } = useAuth();
  const { hasFieldService, isLoading: isPlanLoading } = usePlanLimits();
  const { canEdit, canDelete } = usePagePermission("contracts");
  const financial = usePagePermission("transactions");
  const scope = useServiceOrderScope();
  const allowed = hasFieldService || user?.role === "superadmin";

  const [contract, setContract] = React.useState<ServiceContract | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [charges, setCharges] = React.useState<ContractCharge[] | null>(null);
  const [visits, setVisits] = React.useState<ServiceOrder[] | null>(null);
  const [activateOpen, setActivateOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState<"suspend" | "end" | "delete" | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!allowed || !params.id) return;
    return FieldService.subscribeContract(
      params.id,
      (next) => {
        setContract(next);
        setLoading(false);
      },
      () => {
        setContract(null);
        setLoading(false);
      },
    );
  }, [allowed, params.id]);

  // As mensalidades mudam quando o contrato é ativado ou retomado (a primeira
  // pode sair na hora), então a lista acompanha a situação e a próxima cobrança.
  const chargesKey = `${contract?.status}|${contract?.nextBillingDate}`;
  React.useEffect(() => {
    if (!tenant?.id || !contract?.id || !financial.canView) return;
    let cancelled = false;
    FieldService.listContractCharges(tenant.id, contract.id)
      .then((list) => !cancelled && setCharges(list))
      .catch(() => !cancelled && setCharges([]));
    return () => {
      cancelled = true;
    };
  }, [tenant?.id, contract?.id, financial.canView, chargesKey]);

  const visitsKey = contract?.visitPlan.nextVisitDate;
  React.useEffect(() => {
    if (!tenant?.id || !contract?.id || !scope.seesAll) return;
    let cancelled = false;
    FieldService.listContractVisits(tenant.id, contract.id)
      .then((list) => !cancelled && setVisits(list))
      .catch(() => !cancelled && setVisits([]));
    return () => {
      cancelled = true;
    };
  }, [tenant?.id, contract?.id, scope.seesAll, visitsKey]);

  if (!user) return null;
  if (isPlanLoading) return <ServiceOrdersSkeleton />;
  if (!allowed) {
    return (
      <UpgradeRequired
        feature="Contratos"
        description="Cobre a mensalidade de manutenção todo mês e deixe as visitas preventivas abrirem sozinhas."
      />
    );
  }
  if (loading) return <ServiceOrdersSkeleton />;
  if (!contract) {
    return (
      <EmptyState
        icon={FileSignature}
        title="Contrato não encontrado"
        description="Ele pode ter sido excluído."
        action={
          <Button asChild variant="outline">
            <Link href="/contracts">Voltar aos contratos</Link>
          </Button>
        }
      />
    );
  }

  const writable = !isReadOnly && canEdit;
  const interval = VISIT_INTERVAL_OPTIONS.find((o) => o.value === contract.visitPlan.intervalMonths)?.label;

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      setConfirm(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível concluir a ação.");
    } finally {
      setBusy(false);
    }
  };

  const copyPaymentLink = async (charge: ContractCharge) => {
    try {
      // Reaproveita o link que já existe: gerar de novo mudaria a validade
      // de um link que o cliente talvez já tenha recebido.
      const info = await SharedTransactionService.getShareLinkInfo(charge.id);
      const url = info.exists && info.shareUrl
        ? info.shareUrl
        : (await SharedTransactionService.generateShareLink(charge.id, 60)).shareUrl;
      await navigator.clipboard.writeText(url);
      toast.success("Link de pagamento copiado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o link.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
            <Link href="/contracts">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Contratos
            </Link>
          </Button>
          <p className="text-sm font-medium text-muted-foreground">
            {contract.code} · {CONTRACT_TYPE_LABELS[contract.type]}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">{contract.title}</h1>
            <ContractStatusBadge status={contract.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link href={`/contacts/${contract.clientId}`} className="underline-offset-4 hover:underline">
              {contract.clientName}
            </Link>
          </p>
        </div>

        {writable && (
          <div className="flex flex-wrap gap-2">
            {/* Ativar e retomar ligam a cobrança: criam lançamentos (e a
                NFS-e, se ligada), então pedem o financeiro, como o backend. */}
            {contract.status === "draft" && financial.canCreate && (
              <Button onClick={() => setActivateOpen(true)}>
                <Play className="mr-2 h-4 w-4" />
                Ativar
              </Button>
            )}
            {contract.status === "suspended" && financial.canCreate && (
              <Button
                onClick={() => run(() => FieldService.resumeContract(contract.id), "Contrato retomado.")}
                disabled={busy}
              >
                {busy ? <Loader size="sm" variant="button" className="mr-2" /> : <Play className="mr-2 h-4 w-4" />}
                Retomar
              </Button>
            )}
            {contract.status !== "ended" && (
              <Button variant="outline" onClick={() => router.push(`/contracts/${contract.id}/edit`)}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Button>
            )}
            {contract.status === "active" && (
              <Button variant="outline" onClick={() => setConfirm("suspend")}>
                <Pause className="mr-2 h-4 w-4" />
                Suspender
              </Button>
            )}
            {contract.status !== "ended" && contract.status !== "draft" && (
              <Button variant="outline" onClick={() => setConfirm("end")}>
                <Power className="mr-2 h-4 w-4" />
                Encerrar
              </Button>
            )}
            {contract.status === "draft" && canDelete && (
              <Button variant="outline" onClick={() => setConfirm("delete")}>
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </Button>
            )}
          </div>
        )}
      </div>

      <p className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">{nextStepLabel(contract)}</p>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Mensalidade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="divide-y rounded-lg border">
              {contract.lines.map((line) => (
                <li key={line.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    {line.quantity !== 1 && <span className="text-muted-foreground">{line.quantity}x </span>}
                    {line.name}
                  </span>
                  <span className="shrink-0 font-medium">{formatCurrency(line.quantity * line.unitPrice)}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm text-muted-foreground">
                Vence todo dia {contract.billingDay}
                {contract.startDate ? `, desde ${formatDay(contract.startDate)}` : ""}
                {contract.endDate ? `, até ${formatDay(contract.endDate)}` : ""}
                {contract.issueNfse ? ". Emite nota de serviço ao receber." : "."}
              </span>
              <span className="text-xl font-bold">
                {formatCurrency(contract.monthlyAmount)}
                <span className="text-sm font-normal text-muted-foreground">/mês</span>
              </span>
            </div>
            {contract.notes && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{contract.notes}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-4 w-4" />
              Visitas preventivas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {contract.visitPlan.enabled ? (
              <>
                <p>{interval}</p>
                {contract.visitPlan.nextVisitDate && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <CalendarClock className="h-4 w-4" />
                    Próxima em {formatDay(contract.visitPlan.nextVisitDate)}
                  </p>
                )}
                {visits && visits.length > 0 && (
                  <ul className="space-y-2 border-t pt-3">
                    {visits.map((visit) => (
                      <li key={visit.id}>
                        <Link
                          href={`/service-orders/${visit.id}`}
                          className="flex items-center justify-between gap-2 rounded-md px-1 py-1 hover:bg-muted/50"
                        >
                          <span className="min-w-0 truncate">
                            {visit.code} · {formatWhen(visit.scheduledStart) || "Sem data"}
                          </span>
                          <ServiceOrderStatusBadge status={visit.status} className="shrink-0" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Este contrato não prevê visitas.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {contract.type === "pmoc" && tenant?.id && (
        <PmocCard contract={contract} tenantId={tenant.id} showSettingsLink={writable} canShare={!isReadOnly} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4" />
            Mensalidades lançadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!financial.canView ? (
            <p className="text-sm text-muted-foreground">Você não tem acesso ao financeiro.</p>
          ) : charges === null ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : charges.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {contract.status === "draft"
                ? "Nada lançado ainda: a primeira mensalidade sai quando o contrato for ativado."
                : "Nenhuma mensalidade lançada ainda. Cada uma entra no financeiro dez dias antes do vencimento."}
            </p>
          ) : (
            <ul className="divide-y">
              {charges.map((charge) => (
                <li key={charge.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{charge.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Vence {formatDay(charge.dueDate)} · {CHARGE_STATUS_LABELS[charge.status]}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{formatCurrency(charge.amount)}</span>
                    {charge.status !== "paid" && !isReadOnly && financial.canEdit && (
                      <Button variant="outline" size="sm" onClick={() => copyPaymentLink(charge)}>
                        <Link2 className="mr-1.5 h-4 w-4" />
                        Link de pagamento
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ActivateContractDialog open={activateOpen} onOpenChange={setActivateOpen} contract={contract} />

      <ConfirmDialog
        open={confirm === "suspend"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Suspender ${contract.code}?`}
        description="A mensalidade para de ser lançada e as visitas param de abrir. Ao retomar, o período parado não é cobrado."
        confirmLabel="Suspender"
        isPending={busy}
        onConfirm={() => run(() => FieldService.suspendContract(contract.id), "Contrato suspenso.")}
      />
      <ConfirmDialog
        open={confirm === "end"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Encerrar ${contract.code}?`}
        description="O contrato para de cobrar de vez. As mensalidades já lançadas continuam no financeiro."
        confirmLabel="Encerrar"
        destructive
        isPending={busy}
        onConfirm={() => run(() => FieldService.endContract(contract.id), "Contrato encerrado.")}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Excluir ${contract.code}?`}
        description="O rascunho é apagado. O número não volta para a fila."
        confirmLabel="Excluir"
        destructive
        isPending={busy}
        onConfirm={() =>
          run(async () => {
            await FieldService.removeContract(contract.id);
            router.push("/contracts");
          }, "Contrato excluído.")
        }
      />
    </div>
  );
}
