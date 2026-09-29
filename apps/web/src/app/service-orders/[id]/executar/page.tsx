"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, ClipboardList, MapPin, Phone, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { Textarea } from "@/components/ui/textarea";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import { EmptyState } from "@/components/shared/empty-state";
import { useTenant } from "@/providers/tenant-provider";
import { useAuth } from "@/providers/auth-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { usePagePermission } from "@/hooks/usePagePermission";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { FieldService } from "@/services/field-service-service";
import type { ServiceOrder } from "@/types/field-service";
import { ServiceOrdersSkeleton } from "../../_components/service-orders-skeleton";
import { ServiceOrderStatusBadge } from "../../_components/status-badge";
import { ChecklistEditor } from "../../_components/checklist-editor";
import { ItemsEditor } from "../../_components/items-editor";
import { PhotosSection } from "../../_components/photos-section";
import { CompleteDialog } from "../../_components/complete-dialog";
import { useExecutionDraft } from "../../_components/use-execution-draft";
import { formatWhen, isClosed } from "@/lib/field-service/service-orders";

const STEPS = ["Chegada", "Checklist", "Peças e serviços", "Fotos", "Relatório"] as const;

/**
 * O atendimento no celular do técnico, na casa do cliente: chegar, conferir,
 * lançar as peças, fotografar, relatar e colher a assinatura. Cada avanço
 * salva o que foi preenchido, porque sinal de celular cai.
 */
export default function ExecuteServiceOrderPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { isReadOnly } = useTenant();
  const { user } = useAuth();
  const { hasFieldService, isLoading: isPlanLoading } = usePlanLimits();
  const { canEdit } = usePagePermission("service_orders");
  const allowed = hasFieldService || user?.role === "superadmin";

  const [order, setOrder] = React.useState<ServiceOrder | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [step, setStep] = React.useState(0);
  const [starting, setStarting] = React.useState(false);
  const [completeOpen, setCompleteOpen] = React.useState(false);
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
    return <UpgradeRequired feature="Ordens de serviço" description="Atenda chamados pelo celular, com a assinatura do cliente na tela." />;
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

  const canWork = !isReadOnly && canEdit && !isClosed(order);
  const started = order.status === "in_progress";

  const goTo = async (next: number) => {
    if (canWork && !(await execution.save())) return;
    setStep(next);
    // Quem rola é o <main> do shell, não a janela.
    document.getElementById("main-content")?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const start = async () => {
    setStarting(true);
    try {
      await FieldService.changeStatus(order.id, "in_progress");
      setStep(1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao iniciar o atendimento.");
    } finally {
      setStarting(false);
    }
  };

  const finish = async () => {
    if (await execution.save()) setCompleteOpen(true);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="space-y-2">
        <Link
          href={`/service-orders/${order.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {order.code}
        </Link>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">{order.title}</h1>
          <ServiceOrderStatusBadge status={order.status} className="shrink-0" />
        </div>
      </div>

      <ol className="flex gap-1" aria-label="Etapas do atendimento">
        {STEPS.map((label, index) => (
          <li key={label} className="flex-1">
            <button
              type="button"
              onClick={() => goTo(index)}
              className={cn(
                "h-1.5 w-full rounded-full transition-colors",
                index <= step ? "bg-primary" : "bg-muted",
              )}
              aria-label={label}
              aria-current={index === step ? "step" : undefined}
            />
          </li>
        ))}
      </ol>
      <p className="text-sm font-medium text-muted-foreground">
        Etapa {step + 1} de {STEPS.length}: {STEPS[step]}
      </p>

      {!canWork && (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          {isClosed(order) ? "Esta OS está encerrada e não muda mais." : "Você pode ver esta OS, mas não alterá-la."}
        </p>
      )}

      {step === 0 && (
        <div className="space-y-4 rounded-xl border p-4">
          <p className="text-lg font-semibold">{order.clientName}</p>
          {order.address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-start gap-2 text-primary"
            >
              <MapPin className="mt-0.5 h-5 w-5 shrink-0" />
              {order.address}
            </a>
          )}
          {order.clientPhone && (
            <a href={`tel:${order.clientPhone}`} className="flex items-center gap-2 text-primary">
              <Phone className="h-5 w-5 shrink-0" />
              {order.clientPhone}
            </a>
          )}
          {formatWhen(order.scheduledStart) && (
            <p className="text-sm text-muted-foreground">Marcada para {formatWhen(order.scheduledStart)}</p>
          )}
          {order.equipmentLabels.length > 0 && (
            <div className="border-t pt-3">
              <p className="mb-1 text-sm font-medium">Equipamentos</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {order.equipmentLabels.map((label, i) => (
                  <li key={order.equipmentIds[i] ?? label}>{label}</li>
                ))}
              </ul>
            </div>
          )}
          {order.description && (
            <p className="whitespace-pre-line border-t pt-3 text-sm text-muted-foreground">{order.description}</p>
          )}
          {canWork && !started && (
            <Button className="h-12 w-full text-base" onClick={start} disabled={starting}>
              {starting ? <Loader size="sm" variant="button" className="mr-2" /> : <Play className="mr-2 h-5 w-5" />}
              Cheguei, iniciar atendimento
            </Button>
          )}
        </div>
      )}

      {step === 1 && (
        <ChecklistEditor
          items={execution.draft.checklist}
          onChange={(items) => execution.change("checklist", items)}
          disabled={!canWork}
        />
      )}
      {step === 2 && (
        <ItemsEditor
          items={execution.draft.items}
          onChange={(items) => execution.change("items", items)}
          disabled={!canWork}
        />
      )}
      {step === 3 && <PhotosSection orderId={order.id} photos={order.photos} canEdit={canWork} />}
      {step === 4 && (
        <Textarea
          aria-label="Relatório do técnico"
          value={execution.draft.report}
          onChange={(e) => execution.change("report", e.target.value)}
          rows={8}
          maxLength={8000}
          disabled={!canWork}
          placeholder="O que foi encontrado, o que foi feito e o que fica de recomendação."
        />
      )}

      {/* Grudada no fim do <main>, que é quem rola; a barra de abas do celular
          fica logo abaixo dele, então `fixed` a cobriria. */}
      <div className="sticky bottom-0 z-20 -mx-4 border-t bg-background/95 p-3 backdrop-blur md:mx-0 md:rounded-xl md:border">
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-12 flex-1"
            onClick={() => goTo(step - 1)}
            disabled={step === 0 || execution.saving}
          >
            <ChevronLeft className="mr-1 h-5 w-5" />
            Voltar
          </Button>
          {step < STEPS.length - 1 ? (
            <Button className="h-12 flex-1" onClick={() => goTo(step + 1)} disabled={execution.saving}>
              {execution.saving ? <Loader size="sm" variant="button" className="mr-2" /> : null}
              Avançar
              <ChevronRight className="ml-1 h-5 w-5" />
            </Button>
          ) : canWork ? (
            <Button className="h-12 flex-1" onClick={finish} disabled={execution.saving}>
              {execution.saving ? <Loader size="sm" variant="button" className="mr-2" /> : null}
              Assinar e concluir
            </Button>
          ) : (
            <Button className="h-12 flex-1" variant="outline" onClick={() => router.push(`/service-orders/${order.id}`)}>
              Ver a OS
            </Button>
          )}
        </div>
      </div>

      <CompleteDialog
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        order={order}
        onCompleted={() => router.push(`/service-orders/${order.id}`)}
      />
    </div>
  );
}
