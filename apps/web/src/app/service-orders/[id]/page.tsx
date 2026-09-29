"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Download,
  Landmark,
  Link2,
  MapPin,
  Pencil,
  Phone,
  Play,
  RotateCcw,
  Smartphone,
  Trash2,
  User,
  Wrench,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/ui/loader";
import { Textarea } from "@/components/ui/textarea";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { useTenant } from "@/providers/tenant-provider";
import { useAuth } from "@/providers/auth-provider";
import { usePermissions } from "@/providers/permissions-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { usePagePermission } from "@/hooks/usePagePermission";
import { useServiceOrderScope } from "@/hooks/useServiceOrders";
import { toast } from "@/lib/toast";
import { FieldService } from "@/services/field-service-service";
import { downloadServiceOrderPdf } from "@/services/pdf/download-service-order-pdf";
import type { ServiceOrder } from "@/types/field-service";
import { ServiceOrdersSkeleton } from "../_components/service-orders-skeleton";
import { ServiceOrderStatusBadge } from "../_components/status-badge";
import { ServiceOrderFormDialog } from "@/components/features/field-service/service-order-form-dialog";
import { ChecklistEditor } from "../_components/checklist-editor";
import { ItemsEditor } from "@/components/features/field-service/items-editor";
import { PhotosSection } from "../_components/photos-section";
import { CompleteDialog } from "../_components/complete-dialog";
import { SignatureCard } from "../_components/signature-card";
import { LaunchTransactionDialog } from "../_components/launch-transaction-dialog";
import { useExecutionDraft } from "../_components/use-execution-draft";
import { PRIORITY_LABELS, TYPE_LABELS, formatWhen, isClosed, keepOpenOnOutsideClick } from "@/lib/field-service/service-orders";

/** O detalhe da OS: quem coordena edita tudo, o técnico preenche a execução. */
export default function ServiceOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { isReadOnly } = useTenant();
  const { user } = useAuth();
  const { isMaster } = usePermissions();
  const { hasFieldService, hasFinancial, isLoading: isPlanLoading } = usePlanLimits();
  const { canEdit, canDelete } = usePagePermission("service_orders");
  const { canCreate: canCreateTransaction } = usePagePermission("transactions");
  const scope = useServiceOrderScope();
  const allowed = hasFieldService || user?.role === "superadmin";

  const [order, setOrder] = React.useState<ServiceOrder | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [editOpen, setEditOpen] = React.useState(false);
  const [completeOpen, setCompleteOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [reopenOpen, setReopenOpen] = React.useState(false);
  const [launchOpen, setLaunchOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const execution = useExecutionDraft(order);

  React.useEffect(() => {
    if (!allowed || !params.id) return;
    return FieldService.subscribeOrder(
      params.id,
      (next) => {
        setOrder(next);
        setLoading(false);
      },
      () => {
        setOrder(null);
        setLoading(false);
      },
    );
  }, [allowed, params.id]);

  if (!user) return null;
  if (isPlanLoading) return <ServiceOrdersSkeleton />;
  if (!allowed) {
    return (
      <UpgradeRequired
        feature="Ordens de serviço"
        description="Atenda chamados com ordem de serviço: o técnico preenche no celular e o cliente assina na tela."
      />
    );
  }
  if (loading) return <ServiceOrdersSkeleton />;
  if (!order) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Ordem de serviço não encontrada"
        description="Ela pode ter sido excluída, ou não estar atribuída a você."
        action={
          <Button asChild variant="outline">
            <Link href="/service-orders">Voltar às OS</Link>
          </Button>
        }
      />
    );
  }

  const closed = isClosed(order);
  const writable = !isReadOnly && canEdit;
  const coordinates = writable && scope.seesAll;
  const canWork = writable && !closed;
  const when = formatWhen(order.scheduledStart);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível concluir a ação.");
    } finally {
      setBusy(false);
    }
  };

  const openCompletion = async () => {
    if (await execution.save()) setCompleteOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link href="/service-orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Ordens de serviço
        </Link>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                {order.code} · {TYPE_LABELS[order.type]} · prioridade {PRIORITY_LABELS[order.priority].toLowerCase()}
              </span>
              <ServiceOrderStatusBadge status={order.status} />
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground md:text-3xl">{order.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {coordinates && !closed && (
              <Button variant="outline" onClick={() => setEditOpen(true)} disabled={busy}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Button>
            )}
            {canWork && (order.status === "open" || order.status === "scheduled") && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => run(() => FieldService.changeStatus(order.id, "in_progress"), "Atendimento iniciado.")}
              >
                <Play className="mr-2 h-4 w-4" />
                Iniciar atendimento
              </Button>
            )}
            {canWork && (
              <Button variant="outline" asChild>
                <Link href={`/service-orders/${order.id}/executar`}>
                  <Smartphone className="mr-2 h-4 w-4" />
                  Atender pelo celular
                </Link>
              </Button>
            )}
            {canWork && (
              <Button onClick={openCompletion} disabled={busy || execution.saving}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Concluir
              </Button>
            )}
            {coordinates && !closed && (
              <Button variant="outline" onClick={() => setCancelOpen(true)} disabled={busy}>
                <XCircle className="mr-2 h-4 w-4" />
                Cancelar OS
              </Button>
            )}
            {coordinates && order.status === "canceled" && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => run(() => FieldService.changeStatus(order.id, "open"), "OS reaberta.")}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reabrir
              </Button>
            )}
            {order.status === "completed" && order.transactionId && (
              <Button variant="outline" asChild>
                <Link href={`/transactions/${order.transactionId}`}>
                  <Landmark className="mr-2 h-4 w-4" />
                  Ver lançamento
                </Link>
              </Button>
            )}
            {!isReadOnly &&
              hasFinancial &&
              canCreateTransaction &&
              order.status === "completed" &&
              !order.transactionId &&
              order.totals.total > 0 && (
                <Button variant="outline" onClick={() => setLaunchOpen(true)} disabled={busy}>
                  <Landmark className="mr-2 h-4 w-4" />
                  Lançar no financeiro
                </Button>
              )}
            {!isReadOnly && isMaster && order.status === "completed" && (
              <Button variant="outline" onClick={() => setReopenOpen(true)} disabled={busy}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reabrir
              </Button>
            )}
            {!isReadOnly && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => run(() => downloadServiceOrderPdf(order.id, order.code), "PDF gerado.")}
              >
                <Download className="mr-2 h-4 w-4" />
                PDF
              </Button>
            )}
            {!isReadOnly && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const { url } = await FieldService.shareLink(order.id);
                    await navigator.clipboard.writeText(url);
                  }, "Link da OS copiado. Mande ao cliente.")
                }
              >
                <Link2 className="mr-2 h-4 w-4" />
                Link do cliente
              </Button>
            )}
            {!isReadOnly && canDelete && order.status !== "completed" && (
              <Button variant="ghost" onClick={() => setDeleteOpen(true)} disabled={busy} aria-label="Excluir OS">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Atendimento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="flex items-start gap-2">
                <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{order.clientName}</span>
              </p>
              {order.clientPhone && (
                <a href={`tel:${order.clientPhone}`} className="flex items-start gap-2 text-primary hover:underline">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0" />
                  {order.clientPhone}
                </a>
              )}
              {order.address && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start gap-2 text-primary hover:underline"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  {order.address}
                </a>
              )}
              <p className="flex items-start gap-2">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{when ?? "Sem data marcada"}</span>
              </p>
              <p className="flex items-start gap-2">
                <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{order.technicianName ?? "Sem técnico"}</span>
              </p>
              {order.description && (
                <p className="whitespace-pre-line border-t pt-3 text-muted-foreground">{order.description}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Equipamentos</CardTitle>
            </CardHeader>
            <CardContent>
              {order.equipmentLabels.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum equipamento ligado a esta OS.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {order.equipmentLabels.map((label, i) => (
                    <li key={order.equipmentIds[i] ?? label}>{label}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {order.signature || order.noSignatureReason ? <SignatureCard order={order} /> : null}
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Checklist</CardTitle>
            </CardHeader>
            <CardContent>
              <ChecklistEditor
                items={execution.draft.checklist}
                onChange={(items) => execution.change("checklist", items)}
                disabled={!canWork}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Peças e serviços</CardTitle>
            </CardHeader>
            <CardContent>
              <ItemsEditor
                items={execution.draft.items}
                onChange={(items) => execution.change("items", items)}
                disabled={!canWork}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fotos</CardTitle>
            </CardHeader>
            <CardContent>
              <PhotosSection orderId={order.id} photos={order.photos} canEdit={canWork} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Relatório do técnico</CardTitle>
            </CardHeader>
            <CardContent>
              {canWork ? (
                <Textarea
                  aria-label="Relatório do técnico"
                  value={execution.draft.report}
                  onChange={(e) => execution.change("report", e.target.value)}
                  rows={5}
                  maxLength={8000}
                  placeholder="O que foi encontrado, o que foi feito e o que fica de recomendação."
                />
              ) : (
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {order.report || "Sem relatório."}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {execution.dirty && (
        <div className="sticky bottom-0 z-20 -mx-4 border-t bg-background/95 p-3 backdrop-blur md:mx-0 md:rounded-xl md:border">
          <div className="flex items-center justify-end gap-2">
            <span className="mr-auto text-sm text-muted-foreground">Alterações não salvas</span>
            <Button variant="outline" onClick={execution.discard} disabled={execution.saving}>
              Descartar
            </Button>
            <Button
              onClick={async () => {
                if (await execution.save()) toast.success("Atendimento salvo.");
              }}
              disabled={execution.saving}
            >
              {execution.saving && <Loader size="sm" variant="button" className="mr-2" />}
              Salvar
            </Button>
          </div>
        </div>
      )}

      <ServiceOrderFormDialog open={editOpen} onOpenChange={setEditOpen} order={order} onSaved={() => undefined} />
      <CompleteDialog open={completeOpen} onOpenChange={setCompleteOpen} order={order} onCompleted={() => undefined} />
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={`Cancelar ${order.code}?`}
        description="A OS sai da fila. Se ela já tinha tirado peças do estoque, elas voltam."
        confirmLabel="Cancelar OS"
        destructive
        isPending={busy}
        onConfirm={async () => {
          await run(() => FieldService.changeStatus(order.id, "canceled"), "OS cancelada.");
          setCancelOpen(false);
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Excluir ${order.code}?`}
        description="A OS, as fotos e a assinatura são apagadas de vez. O número não volta para a fila."
        confirmLabel="Excluir"
        destructive
        isPending={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            await FieldService.removeOrder(order.id);
            toast.success("OS excluída.");
            router.push("/service-orders");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Erro ao excluir a OS.");
          } finally {
            setBusy(false);
            setDeleteOpen(false);
          }
        }}
      />
      <ReopenDialog open={reopenOpen} onOpenChange={setReopenOpen} order={order} />
      <LaunchTransactionDialog open={launchOpen} onOpenChange={setLaunchOpen} order={order} />
    </div>
  );
}

function ReopenDialog({
  open,
  onOpenChange,
  order,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: ServiceOrder;
}) {
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const submit = async () => {
    setSaving(true);
    try {
      await FieldService.reopen(order.id, reason.trim());
      toast.success(`${order.code} reaberta.`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao reabrir a OS.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md" onInteractOutside={keepOpenOnOutsideClick}>
        <DialogHeader>
          <DialogTitle>Reabrir {order.code}</DialogTitle>
          <DialogDescription>
            A assinatura sai da OS e fica guardada no histórico junto com o motivo. Para concluir de novo,
            o cliente assina outra vez.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reopenReason">Motivo</Label>
          <Textarea
            id="reopenReason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={300}
            disabled={saving}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Voltar
          </Button>
          <Button type="button" onClick={submit} disabled={saving || reason.trim().length < 3}>
            {saving && <Loader size="sm" variant="button" className="mr-2" />}
            Reabrir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
