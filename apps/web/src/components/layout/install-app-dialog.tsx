"use client";

import { Share, SquarePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface InstallAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Passo a passo de instalação no iPhone e no iPad, que não deixam o site abrir
 * o diálogo de instalação por código: ela é feita pelo menu Compartilhar.
 */
export function InstallAppDialog({ open, onOpenChange }: InstallAppDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Instalar a ProOps</DialogTitle>
          <DialogDescription>
            Com a ProOps na tela de início, ela abre como um aplicativo, em tela
            cheia e sem a barra do navegador.
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-3 text-sm">
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              1
            </span>
            <span>
              Toque em <strong>Compartilhar</strong>{" "}
              <Share className="inline h-4 w-4 align-text-bottom" aria-hidden />{" "}
              na barra do navegador.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              2
            </span>
            <span>
              Escolha <strong>Adicionar à Tela de Início</strong>{" "}
              <SquarePlus
                className="inline h-4 w-4 align-text-bottom"
                aria-hidden
              />
              . Se não aparecer, role a lista de opções para baixo.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              3
            </span>
            <span>
              Toque em <strong>Adicionar</strong>. O ícone da ProOps aparece na
              tela de início.
            </span>
          </li>
        </ol>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
