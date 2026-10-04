"use client";

import * as React from "react";
import { Eye, LogOut, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface ImpersonationBarProps {
  companyName: string;
  planLabel?: string | null;
  writeEnabled: boolean;
  onToggleWrite: (enabled: boolean) => void;
  onExit: () => void;
  /** Nome do membro no "Ver como membro". Sempre somente leitura. */
  memberName?: string | null;
  /** Seletor "Ver como" (empresa ou um membro). */
  memberSwitcher?: React.ReactNode;
}

/**
 * Faixa do "Acessar Painel": diz ao superadmin QUAL empresa ele esta vendo,
 * em qual plano e se o que ele fizer grava de verdade. Abre sempre em somente
 * leitura; habilitar edicao pede confirmacao porque cada gravacao cai nos dados
 * reais do cliente (e fica auditada).
 *
 * No "Ver como membro" a faixa diz QUEM está sendo visto e não oferece
 * edição: o que fosse gravado ficaria em nome do membro.
 */
export function ImpersonationBar({
  companyName,
  planLabel,
  writeEnabled,
  onToggleWrite,
  onExit,
  memberName,
  memberSwitcher,
}: ImpersonationBarProps) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const isMemberView = Boolean(memberName);

  return (
    <>
      <div
        role="status"
        data-testid="impersonation-bar"
        data-mode={isMemberView ? "member" : writeEnabled ? "write" : "read"}
        className={cn(
          "flex min-w-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs shadow-sm animate-in fade-in slide-in-from-top-1 duration-300",
          writeEnabled
            ? "border-amber-500/50 bg-amber-500/10"
            : "border-border/60 bg-background/50 backdrop-blur-sm",
        )}
      >
        {writeEnabled ? (
          <PencilLine className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
        ) : (
          <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        )}
        {isMemberView ? (
          <span className="min-w-0 truncate font-medium text-foreground/90">
            <span className="hidden sm:inline">Vendo como </span>
            {memberName}
            <span className="hidden font-normal text-muted-foreground sm:inline">
              {" "}· {companyName}
            </span>
          </span>
        ) : (
          <span className="min-w-0 truncate font-medium text-foreground/90">
            <span className="hidden sm:inline">Visualizando </span>
            {companyName}
          </span>
        )}
        {planLabel && (
          <span className="hidden shrink-0 text-muted-foreground lg:inline">
            · {planLabel}
          </span>
        )}
        <span
          className={cn(
            "hidden shrink-0 rounded-full px-2 py-0.5 font-medium md:inline",
            writeEnabled
              ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
              : "bg-muted text-muted-foreground",
          )}
        >
          {writeEnabled ? "Edição habilitada" : "Somente leitura"}
        </span>

        {memberSwitcher && (
          <>
            <div className="h-3 w-px shrink-0 bg-border" />
            {memberSwitcher}
          </>
        )}

        {!isMemberView && (
          <>
            <div className="h-3 w-px shrink-0 bg-border" />

            <Button
              variant="ghost"
              size="sm"
              onClick={() => (writeEnabled ? onToggleWrite(false) : setConfirmOpen(true))}
              className="h-auto shrink-0 p-0 max-md:min-h-9 max-md:px-1 text-xs font-medium text-muted-foreground hover:bg-transparent hover:text-foreground"
            >
              {writeEnabled ? "Voltar a só leitura" : "Habilitar edição"}
            </Button>
          </>
        )}

        <div className="h-3 w-px shrink-0 bg-border" />

        <Button
          variant="ghost"
          size="sm"
          onClick={onExit}
          aria-label="Voltar ao painel super admin"
          className="h-auto shrink-0 p-0 max-md:min-h-9 max-md:px-1 text-xs font-medium text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          <span className="hidden sm:inline">Sair</span>
          <LogOut className="h-3 w-3 sm:ml-1.5" />
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Habilitar edição em {companyName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Tudo o que você criar, editar ou excluir a partir de agora grava
              nos dados reais desta empresa, e cada alteração fica registrada na
              auditoria com o seu usuário. A edição vale só para esta empresa e
              volta a somente leitura quando você sair.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onToggleWrite(true);
                setConfirmOpen(false);
              }}
            >
              Habilitar edição
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
