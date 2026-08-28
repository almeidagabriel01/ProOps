"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, FileText, Loader2, Settings } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api-client";
import { FiscalService, type FiscalGap } from "@/services/fiscal-service";

/** Rótulo humano de cada área que o usuário precisa corrigir. */
const SCOPE_LABEL: Record<FiscalGap["scope"], string> = {
  emitente: "Dados da sua empresa",
  cliente: "Cadastro do cliente",
  produto: "Cadastro de produtos",
  servico: "Cadastro de serviços",
};

const SCOPE_HREF: Partial<Record<FiscalGap["scope"], string>> = {
  emitente: "/settings/fiscal",
  produto: "/products",
  servico: "/services",
};

interface IssueInvoiceButtonProps {
  /** De onde a nota nasce. Uma proposta mista pode gerar duas. */
  source: "proposal" | "transaction";
  sourceId: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm";
  className?: string;
  onIssued?: () => void;
}

export function IssueInvoiceButton({
  source,
  sourceId,
  variant = "outline",
  size = "sm",
  className,
  onIssued,
}: IssueInvoiceButtonProps) {
  const [isIssuing, setIsIssuing] = React.useState(false);
  const [gaps, setGaps] = React.useState<FiscalGap[] | null>(null);

  const handleIssue = async () => {
    setIsIssuing(true);
    try {
      const result =
        source === "proposal"
          ? await FiscalService.issueFromProposal(sourceId)
          : await FiscalService.issueFromTransaction(sourceId);

      const count = result.invoices.length;
      toast.success(
        count > 1 ? `${count} notas enviadas` : "Nota enviada",
        {
          // A autorização é assíncrona: prometer "emitida" aqui seria mentira.
          description:
            "A autorização chega em alguns instantes. Acompanhe em Notas Fiscais.",
        },
      );
      onIssued?.();
    } catch (error) {
      // O corpo da resposta vem em `ApiError.data`, não na raiz do erro —
      // `error.code` seria sempre undefined.
      const payload = (error instanceof ApiError ? error.data : null) as {
        code?: string;
        gaps?: FiscalGap[];
        message?: string;
      } | null;

      // Lacunas viram checklist, não um toast de erro que some em 4 segundos.
      if (payload?.code === "FISCAL_INCOMPLETO" && payload.gaps?.length) {
        setGaps(payload.gaps);
        return;
      }

      if (payload?.code === "FISCAL_NAO_CONFIGURADO") {
        toast.error("Emissão de notas ainda não configurada", {
          description: "Configure os dados fiscais da sua empresa para começar a emitir.",
        });
        return;
      }

      if (payload?.code === "LANCAMENTO_SEM_PROPOSTA") {
        toast.error("Este lançamento não tem proposta vinculada", {
          description:
            "A nota é montada a partir dos itens da proposta. Emita pela proposta correspondente.",
        });
        return;
      }

      toast.error(
        payload?.message ||
          (error instanceof Error ? error.message : "Não foi possível emitir a nota."),
      );
    } finally {
      setIsIssuing(false);
    }
  };

  // Agrupa por área para o usuário resolver uma tela de cada vez.
  const groupedGaps = React.useMemo(() => {
    if (!gaps) return [];
    const groups = new Map<FiscalGap["scope"], FiscalGap[]>();
    for (const gap of gaps) {
      const list = groups.get(gap.scope) ?? [];
      list.push(gap);
      groups.set(gap.scope, list);
    }
    return [...groups.entries()];
  }, [gaps]);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleIssue}
        disabled={isIssuing}
      >
        {isIssuing ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileText className="mr-2 h-4 w-4" />
        )}
        Emitir NF
      </Button>

      <Dialog open={gaps !== null} onOpenChange={(open) => !open && setGaps(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Faltam dados para emitir
            </DialogTitle>
            <DialogDescription>
              Complete os itens abaixo e tente de novo. Nenhuma nota foi enviada.
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[50vh] flex-col gap-4 overflow-y-auto">
            {groupedGaps.map(([scope, scopeGaps]) => (
              <div key={scope} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{SCOPE_LABEL[scope]}</p>
                  {SCOPE_HREF[scope] && (
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={SCOPE_HREF[scope]!}>
                        <Settings className="mr-1.5 h-3.5 w-3.5" />
                        Abrir
                      </Link>
                    </Button>
                  )}
                </div>
                <ul className="flex flex-col gap-1.5">
                  {scopeGaps.map((gap, index) => (
                    <li
                      key={`${gap.field}-${gap.entityId ?? index}`}
                      className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
                    >
                      {gap.message}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGaps(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
