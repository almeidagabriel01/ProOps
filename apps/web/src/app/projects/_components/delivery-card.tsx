"use client";

import * as React from "react";
import { CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SendLinkPanel } from "@/components/shared/send-link-panel";
import { toast } from "@/lib/toast";
import { buildDeliveryMessage } from "@/lib/send-link";
import { formatDateBR } from "@/utils/date-format";
import { ProjectsService } from "@/services/projects-service";
import type { Project } from "@/types/project";

interface DeliveryCardProps {
  project: Project;
  companyName?: string | null;
  canEdit: boolean;
}

/**
 * A entrega da obra: a empresa envia o link, o cliente confere etapas e fotos
 * e aceita com nome e CPF/CNPJ. Aceita, o projeto fica concluído.
 */
export function DeliveryCard({ project, companyName, canEdit }: DeliveryCardProps) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const delivery = project.delivery ?? { status: "none", acceptance: null };

  const openLink = async () => {
    setLoading(true);
    try {
      const res = await ProjectsService.deliveryLink(project.id);
      setUrl(res.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao gerar o link de entrega.");
    } finally {
      setLoading(false);
    }
  };

  const content = url
    ? buildDeliveryMessage({
        clientName: project.clientName,
        projectTitle: project.title,
        companyName,
        url,
      })
    : null;

  return (
    <section aria-label="Entrega" className="space-y-3 rounded-xl border bg-card p-4">
      <h3 className="font-semibold">Entrega</h3>
      {delivery.status === "accepted" && delivery.acceptance ? (
        <p className="flex items-start gap-2 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <span>
            {delivery.acceptance.name} aceitou a entrega em {formatDateBR(delivery.acceptance.acceptedAt)}.
          </span>
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {delivery.status === "sent"
              ? "Link enviado. Assim que o cliente aceitar, o projeto fica concluído e você é avisado."
              : "Com a obra pronta, envie o link: o cliente confere as etapas e as fotos e aceita a entrega."}
          </p>
          {canEdit && project.status !== "canceled" && (
            <Button onClick={() => void openLink()} disabled={loading}>
              <Send className="mr-2 h-4 w-4" />
              {loading ? "Gerando link..." : delivery.status === "sent" ? "Reenviar link de entrega" : "Enviar para o cliente aceitar"}
            </Button>
          )}
        </>
      )}

      <Dialog open={url !== null} onOpenChange={(open) => !open && setUrl(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Enviar a entrega
            </DialogTitle>
            <DialogDescription className="line-clamp-1">
              {project.title}
              {project.clientName ? ` para ${project.clientName}` : ""}
            </DialogDescription>
          </DialogHeader>
          {url && content && (
            <SendLinkPanel
              url={url}
              subject={content.subject}
              defaultMessage={content.message}
              phone={project.clientPhone}
              email={project.clientEmail}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
