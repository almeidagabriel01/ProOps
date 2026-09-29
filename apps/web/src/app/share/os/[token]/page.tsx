"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader } from "@/components/ui/loader";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";
import { STATUS_LABELS, TYPE_LABELS, formatWhen } from "@/lib/field-service/service-orders";
import {
  SharedServiceOrderService,
  type SharedServiceOrderTenant,
  type SharedServiceOrderView,
} from "@/services/field-service-service";

/**
 * O comprovante da ordem de serviço para o cliente: o que foi feito, as peças,
 * as fotos e a assinatura. É também a página que o backend imprime no PDF
 * (`?print=1`, marcador `data-pdf-service-order-ready`).
 */
export default function SharedServiceOrderPage() {
  const params = useParams();
  const token = String(params.token || "");
  const [order, setOrder] = React.useState<SharedServiceOrderView | null>(null);
  const [tenant, setTenant] = React.useState<SharedServiceOrderTenant | null>(null);
  const [error, setError] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    SharedServiceOrderService.get(token)
      .then((res) => {
        if (cancelled) return;
        setOrder(res.order);
        setTenant(res.tenant);
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader size="lg" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Link indisponível</AlertTitle>
              <AlertDescription>Link inválido ou ordem de serviço não encontrada.</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  const accent = tenant?.primaryColor || undefined;

  return (
    <div className="min-h-screen bg-background print:bg-white">
      <header className="border-b bg-card print:border-b-2" style={accent ? { borderColor: accent } : undefined}>
        <div className="container mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {tenant?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- logo da empresa, também impresso no PDF
              <img src={tenant.logoUrl} alt={tenant.name ?? "Logo"} className="h-10 w-auto shrink-0 rounded-md object-contain" />
            )}
            <div className="min-w-0">
              <p className="truncate font-bold">{tenant?.name || "Ordem de serviço"}</p>
              <p className="truncate text-sm text-muted-foreground">Ordem de serviço {order.code}</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full border px-3 py-1 text-xs font-medium">{STATUS_LABELS[order.status]}</span>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl space-y-6 px-4 py-6">
        <section>
          <p className="text-sm text-muted-foreground">{TYPE_LABELS[order.type]}</p>
          <h1 className="break-words text-2xl font-bold">{order.title}</h1>
          {order.description && <p className="mt-1 whitespace-pre-line text-muted-foreground">{order.description}</p>}
        </section>

        <section className="grid gap-4 rounded-lg border bg-card p-4 text-sm sm:grid-cols-2">
          <Info label="Cliente" value={order.clientName} />
          <Info label="Endereço" value={order.address} />
          <Info label="Técnico" value={order.technicianName} />
          <Info label="Atendimento" value={formatWhen(order.checkInAt ?? order.scheduledStart)} />
          {order.equipmentLabels.length > 0 && (
            <div className="sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Equipamentos</p>
              <ul className="mt-1 space-y-0.5">
                {order.equipmentLabels.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {order.checklist.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-semibold">Checklist</h2>
            <ul className="space-y-1 text-sm">
              {order.checklist.map((item, i) => (
                <li key={`${item.text}-${i}`} className={cn("flex items-center gap-2", !item.done && "text-muted-foreground")}>
                  {item.done ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0" />
                  )}
                  {item.text}
                </li>
              ))}
            </ul>
          </section>
        )}

        {order.items.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-semibold">Peças e serviços</h2>
            <div className="overflow-hidden rounded-lg border text-sm">
              {order.items.map((item, i) => (
                <div key={`${item.name}-${i}`} className="flex items-start justify-between gap-3 border-b px-3 py-2 last:border-b-0">
                  <span className="min-w-0">
                    {item.name}
                    <span className="block text-xs text-muted-foreground">
                      {item.quantity} x {formatCurrency(item.unitPrice)}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium">{formatCurrency(item.quantity * item.unitPrice)}</span>
                </div>
              ))}
              <div className="flex justify-between bg-muted/50 px-3 py-2 font-semibold">
                <span>Total</span>
                <span>{formatCurrency(order.totals.total)}</span>
              </div>
            </div>
          </section>
        )}

        {order.report && (
          <section className="space-y-2">
            <h2 className="font-semibold">Relatório do técnico</h2>
            <p className="whitespace-pre-line text-sm">{order.report}</p>
          </section>
        )}

        {order.photos.length > 0 && (
          <section className="space-y-2 print:break-inside-avoid">
            <h2 className="font-semibold">Fotos</h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {order.photos.map((photo) => (
                <a key={photo.url} href={photo.url} target="_blank" rel="noopener noreferrer" className="aspect-square overflow-hidden rounded-md border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element -- foto do Storage com token */}
                  <img src={photo.url} alt={photo.caption || "Foto do atendimento"} className="h-full w-full object-cover" />
                </a>
              ))}
            </div>
          </section>
        )}

        {(order.signature || order.noSignatureReason) && (
          <section className="space-y-2 print:break-inside-avoid">
            <h2 className="font-semibold">Assinatura do cliente</h2>
            {order.signature ? (
              <div className="rounded-lg border p-4 text-sm">
                <div className="rounded-md bg-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- PNG da assinatura */}
                  <img src={order.signature.imageUrl} alt={`Assinatura de ${order.signature.name}`} className="mx-auto max-h-32" />
                </div>
                <p className="mt-2 font-medium">{order.signature.name}</p>
                {order.signature.document && <p className="text-muted-foreground">{order.signature.document}</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  Assinada eletronicamente em {formatWhen(order.signature.signedAt)}. Código de conferência{" "}
                  <span className="font-mono">{order.signature.contentHash.slice(0, 16)}</span>.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Concluída sem assinatura: {order.noSignatureReason}</p>
            )}
          </section>
        )}
      </main>
      <span data-pdf-service-order-ready="1" style={{ display: "none" }} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}
