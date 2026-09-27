"use client";

import * as React from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader } from "@/components/ui/loader";
import { cn } from "@/lib/utils";
import {
  SharedProjectService,
  type SharedProjectTenant,
  type SharedProjectView,
} from "@/services/projects-service";
import { DeliveryAcceptance } from "./_components/delivery-acceptance";

const STAGE_LABEL = { pending: "A fazer", in_progress: "Em andamento", done: "Concluída" } as const;

/** Página pública da entrega da obra: etapas, checklist, fotos e o aceite. */
export default function SharedProjectPage() {
  const params = useParams();
  const token = String(params.token || "");
  const [project, setProject] = React.useState<SharedProjectView | null>(null);
  const [tenant, setTenant] = React.useState<SharedProjectTenant | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    SharedProjectService.get(token)
      .then((res) => {
        if (cancelled) return;
        setProject(res.project);
        setTenant(res.tenant);
      })
      .catch((err: { status?: number }) => {
        if (cancelled) return;
        setError(
          err?.status === 410
            ? "Este link expirou. Peça um novo à empresa."
            : "Link inválido ou projeto não encontrado.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
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

  if (error || !project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{error ?? "Projeto não encontrado."}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tenantName = tenant?.name || "a empresa";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center gap-3 px-4 py-3">
          {tenant?.logoUrl && (
            <Image
              src={tenant.logoUrl}
              alt={tenantName}
              width={40}
              height={40}
              className="h-10 w-auto shrink-0 rounded-md object-contain"
            />
          )}
          <div className="min-w-0">
            <p className="truncate font-bold">{tenant?.name || "Entrega da obra"}</p>
            <p className="truncate text-sm text-muted-foreground">Entrega da obra</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div>
          <h1 className="break-words text-2xl font-bold">{project.title}</h1>
          {project.clientName && <p className="text-muted-foreground">{project.clientName}</p>}
          {project.address && <p className="text-sm text-muted-foreground">{project.address}</p>}
        </div>

        <DeliveryAcceptance
          token={token}
          delivery={project.delivery}
          projectStatus={project.status}
          tenantName={tenantName}
          primaryColor={tenant?.primaryColor}
          onAccepted={(acceptance) =>
            setProject((prev) =>
              prev ? { ...prev, status: "completed", delivery: { status: "accepted", acceptance } } : prev,
            )
          }
        />

        <ol className="space-y-4">
          {project.stages.map((stage, index) => (
            <li key={stage.id} className={cn("space-y-3 rounded-lg border bg-card p-4", stage.status === "done" && "border-emerald-500/40")}>
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 font-semibold">
                  {stage.status === "done" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                  {index + 1}. {stage.name}
                </p>
                <span className="text-xs text-muted-foreground">{STAGE_LABEL[stage.status]}</span>
              </div>
              {stage.checklist.length > 0 && (
                <ul className="space-y-1 text-sm">
                  {stage.checklist.map((item) => (
                    <li key={item.id} className={cn("flex items-center gap-2", !item.done && "text-muted-foreground")}>
                      {item.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="h-4 w-4 shrink-0" />}
                      {item.text}
                    </li>
                  ))}
                </ul>
              )}
              {stage.photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {stage.photos.map((photo) => (
                    <a key={photo.id} href={photo.url} target="_blank" rel="noopener noreferrer" className="aspect-square overflow-hidden rounded-md border bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt={photo.caption || `Foto da etapa ${stage.name}`} className="h-full w-full object-cover" loading="lazy" />
                    </a>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
