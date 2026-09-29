"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileSignature, HardHat } from "lucide-react";
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
import { toast } from "@/lib/toast";
import { subscribeProjectApproval } from "@/lib/project-on-approval";
import { APPROVAL_DIALOG_PRIORITY, useApprovalDialogTurn } from "@/lib/approval-dialog-queue";
import { ProjectsService } from "@/services/projects-service";

/**
 * Depois de uma aprovação: avisa que o projeto da obra foi criado (modo
 * "sempre") ou pergunta se a venda tem instalação (modo padrão). Montado uma
 * vez no shell, então vale para a lista, o formulário e o quadro do CRM.
 */
export function ProjectOnApprovalHost() {
  const router = useRouter();
  const [suggestion, setSuggestion] = React.useState<{ proposalId: string; proposalTitle: string } | null>(null);
  const [creating, setCreating] = React.useState(false);
  // Espera a vez: o convite da nota fiscal vem antes, porque criar o projeto
  // leva para a tela da obra e o convite da nota se perderia na troca.
  const hasTurn = useApprovalDialogTurn(
    "project-on-approval",
    suggestion !== null,
    APPROVAL_DIALOG_PRIORITY.project,
  );
  // O contrato nascido da mensalidade da proposta. Diálogo, e não toast: a
  // aprovação dispara outros avisos juntos (status, Google Drive), e o toast
  // do contrato ficava por baixo deles, sem ninguém ver que era preciso ativar.
  // Declarado DEPOIS do projeto: no mesmo render, a fila atende quem pede antes.
  const [contract, setContract] = React.useState<{ contractId: string; proposalTitle: string } | null>(null);
  const hasContractTurn = useApprovalDialogTurn(
    "contract-on-approval",
    contract !== null,
    APPROVAL_DIALOG_PRIORITY.contract,
  );

  React.useEffect(
    () =>
      subscribeProjectApproval((event) => {
        if (event.kind === "contract_created") {
          setContract({ contractId: event.contractId, proposalTitle: event.proposalTitle });
        } else if (event.kind === "created") {
          toast.success("Projeto de instalação criado para acompanhar a obra.", {
            duration: 8000,
            // O sileo recolhe o toast 2s antes do fim, escondendo o botão.
            autopilot: { expand: 150, collapse: 7700 },
            button: { title: "Abrir", onClick: () => router.push(`/projects/${event.projectId}`) },
          });
        } else {
          setSuggestion({ proposalId: event.proposalId, proposalTitle: event.proposalTitle });
        }
      }),
    [router],
  );

  const create = async () => {
    if (!suggestion) return;
    setCreating(true);
    try {
      const { projectId } = await ProjectsService.create({ proposalId: suggestion.proposalId });
      setSuggestion(null);
      toast.success("Projeto da obra criado.");
      router.push(`/projects/${projectId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar o projeto.");
    } finally {
      setCreating(false);
    }
  };

  const openContract = () => {
    if (!contract) return;
    const id = contract.contractId;
    setContract(null);
    router.push(`/contracts/${id}`);
  };

  return (
    <>
    <Dialog open={contract !== null && hasContractTurn} onOpenChange={(open) => !open && setContract(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" />
            A mensalidade virou um contrato
          </DialogTitle>
          <DialogDescription className="break-words">
            {contract?.proposalTitle ? `"${contract.proposalTitle}" tinha itens mensais. ` : "A proposta tinha itens mensais. "}
            O contrato ficou como rascunho: ative escolhendo a data de início para a mensalidade começar a
            entrar no financeiro.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setContract(null)}>
            Depois
          </Button>
          <Button onClick={openContract}>Abrir o contrato</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={suggestion !== null && hasTurn} onOpenChange={(open) => !open && !creating && setSuggestion(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardHat className="h-5 w-5 text-primary" />
            Esta venda tem instalação?
          </DialogTitle>
          <DialogDescription className="break-words">
            {suggestion?.proposalTitle ? `"${suggestion.proposalTitle}" foi aprovada. ` : "A proposta foi aprovada. "}
            Crie o projeto da obra para acompanhar etapas, fotos e a entrega. Se não tiver
            instalação, é só seguir: o botão continua na proposta.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setSuggestion(null)} disabled={creating}>
            Agora não
          </Button>
          <Button onClick={() => void create()} disabled={creating}>
            {creating && <Loader size="sm" variant="button" />}
            Criar projeto da obra
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
