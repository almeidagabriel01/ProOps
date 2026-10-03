"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, FileSignature, FileText, HardHat } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { FiscalGapsDialog } from "@/components/features/fiscal/fiscal-gaps-dialog";
import { useIssueInvoice } from "@/hooks/use-issue-invoice";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  INVOICE_WAIT_MS,
  dismissApprovalSteps,
  getApprovalEntries,
  isEntryReady,
  isInformationalOnly,
  subscribeApprovalSteps,
  type ApprovalEntry,
} from "@/lib/approval-next-steps";
import { ProjectsService } from "@/services/projects-service";

const TIPO_LABEL: Record<"nfe" | "nfse", string> = {
  nfe: "NF-e dos produtos",
  nfse: "NFS-e do serviço",
};

function useApprovalEntries(): ApprovalEntry[] {
  return React.useSyncExternalStore(subscribeApprovalSteps, getApprovalEntries, getApprovalEntries);
}

interface StepRowProps {
  icon: React.ElementType;
  title: string;
  description: string;
  done?: string | null;
  children?: React.ReactNode;
}

function StepRow({ icon: Icon, title, description, done, children }: StepRowProps) {
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            done ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground",
          )}
        >
          {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{done ?? description}</p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2 sm:justify-end">{children}</div>
    </li>
  );
}

/**
 * A janela "Proposta aprovada": uma só, com os próximos passos que couberem
 * naquela venda (nota fiscal, obra, contrato), cada um opcional. Montada uma
 * vez no shell, vale para a lista, o quadro e o formulário.
 */
export function ApprovalNextStepsHost() {
  const router = useRouter();
  const entries = useApprovalEntries();
  const [now, setNow] = React.useState(() => Date.now());
  const [invoiceDone, setInvoiceDone] = React.useState(false);
  const [creatingProject, setCreatingProject] = React.useState(false);
  const [createdProjectId, setCreatedProjectId] = React.useState<string | null>(null);
  const { issue, issuingId, gaps, closeGaps } = useIssueInvoice(() => setInvoiceDone(true));

  // A obra criada sozinha (modo "sempre") sem mais nada a decidir: aviso curto.
  React.useEffect(() => {
    for (const entry of entries) {
      if (!isInformationalOnly(entry) || entry.invoicePendingSince !== null) continue;
      const projectId = entry.project?.kind === "created" ? entry.project.projectId : null;
      dismissApprovalSteps(entry.proposalId);
      toast.success("Projeto de instalação criado para acompanhar a obra.", {
        duration: 8000,
        // O sileo recolhe o toast 2s antes do fim, escondendo o botão.
        autopilot: { expand: 150, collapse: 7700 },
        button: projectId ? { title: "Abrir", onClick: () => router.push(`/projects/${projectId}`) } : undefined,
      });
    }
  }, [entries, router]);

  // Enquanto uma proposta espera a consulta da nota, reavalia quando o prazo
  // de espera vencer: a janela abre sem a nota em vez de nunca abrir.
  const waiting = entries.find((e) => e.invoicePendingSince !== null);
  React.useEffect(() => {
    if (!waiting?.invoicePendingSince) return;
    const remaining = waiting.invoicePendingSince + INVOICE_WAIT_MS - Date.now();
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(0, remaining) + 50);
    return () => window.clearTimeout(timer);
  }, [waiting?.invoicePendingSince]);

  const entry = entries.find((e) => !isInformationalOnly(e) && isEntryReady(e, Math.max(now, Date.now()))) ?? null;
  const entryId = entry?.proposalId ?? null;

  // Cada proposta começa com as linhas por fazer.
  React.useEffect(() => {
    setInvoiceDone(false);
    setCreatedProjectId(null);
  }, [entryId]);

  const issuing = entry !== null && issuingId === entry.proposalId;
  const busy = issuing || creatingProject;

  const close = () => {
    if (entry && !busy) dismissApprovalSteps(entry.proposalId);
  };

  const go = (path: string) => {
    if (entry) dismissApprovalSteps(entry.proposalId);
    router.push(path);
  };

  const createProject = async () => {
    if (!entry) return;
    setCreatingProject(true);
    try {
      const { projectId } = await ProjectsService.create({ proposalId: entry.proposalId });
      setCreatedProjectId(projectId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar o projeto.");
    } finally {
      setCreatingProject(false);
    }
  };

  const documentos = entry?.invoice?.documentos ?? [];
  const invoiceDescription =
    documentos.length > 0
      ? `Sai a ${documentos.map((doc) => TIPO_LABEL[doc.type]).join(" e a ")}.`
      : "Emitir a nota desta venda.";
  const projectId = entry?.project?.kind === "created" ? entry.project.projectId : createdProjectId;

  return (
    <>
      <Dialog open={entry !== null && gaps === null} onOpenChange={(open) => !open && close()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Proposta aprovada
            </DialogTitle>
            <DialogDescription className="break-words">
              {entry?.proposalTitle ? `"${entry.proposalTitle}" foi aprovada. ` : "A proposta foi aprovada. "}
              Os próximos passos são opcionais: dá para fazer agora ou depois, pela própria proposta.
            </DialogDescription>
          </DialogHeader>

          <ul className="divide-y rounded-xl border">
            {entry?.invoice && (
              <StepRow
                icon={FileText}
                title="Nota fiscal"
                description={invoiceDescription}
                done={invoiceDone ? "Enviada. A autorização chega em instantes, em Notas Fiscais." : null}
              >
                {!invoiceDone && (
                  <Button size="sm" onClick={() => void issue("proposal", entry.proposalId)} disabled={busy}>
                    {issuing && <Loader size="sm" variant="button" className="mr-2" />}
                    Emitir
                  </Button>
                )}
              </StepRow>
            )}
            {entry?.project && (
              <StepRow
                icon={HardHat}
                title="Obra"
                description="Acompanhe as etapas, as fotos e a entrega da instalação."
                done={projectId ? "Obra criada." : null}
              >
                {projectId ? (
                  <Button size="sm" variant="outline" onClick={() => go(`/projects/${projectId}`)} disabled={busy}>
                    Abrir a obra
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => void createProject()} disabled={busy}>
                    {creatingProject && <Loader size="sm" variant="button" className="mr-2" />}
                    Criar obra
                  </Button>
                )}
              </StepRow>
            )}
            {entry?.contract && (
              <StepRow
                icon={FileSignature}
                title="Contrato"
                description="A mensalidade virou um contrato em rascunho. Ative para começar a cobrar."
              >
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => go(`/contracts/${entry.contract!.contractId}`)}
                  disabled={busy}
                >
                  Abrir o contrato
                </Button>
              </StepRow>
            )}
          </ul>

          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={busy}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rede de segurança: o preview já garante que não há lacunas, mas o
          cadastro pode mudar entre a consulta e a emissão. Fechar a lista
          volta para a janela, com as outras linhas. */}
      <FiscalGapsDialog gaps={gaps} onClose={closeGaps} />
    </>
  );
}
