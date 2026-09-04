"use client";

import * as React from "react";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { toast } from "@/lib/toast";
import { DriveService } from "@/services/drive-service";
import { usePlanLimits } from "@/hooks/usePlanLimits";

/**
 * Abre a pasta do cliente no Google Drive.
 *
 * A pasta é criada **sob demanda**, no primeiro clique — e não em todo cadastro
 * de cliente. Criar antecipadamente encheria o Drive de pastas vazias para
 * contatos que nunca viraram proposta, e cada uma delas seria uma chamada à API
 * do Google num momento em que ninguém pediu nada.
 *
 * O botão existe para quem VÊ o contato, não só para o master: foi exatamente
 * o caso de uso que originou o pedido — o vendedor na casa do cliente, com a
 * documentação e a proposta na mão pelo celular, sem abrir o ERP.
 */

interface OpenDriveFolderButtonProps {
  clientId: string;
  className?: string;
}

export function OpenDriveFolderButton({
  clientId,
  className,
}: OpenDriveFolderButtonProps) {
  const { hasDriveSync } = usePlanLimits();
  const [isOpening, setIsOpening] = React.useState(false);

  if (!hasDriveSync) {
    return null;
  }

  async function handleClick() {
    setIsOpening(true);
    // Aberto ANTES do await: o navegador só permite abrir aba nova durante o
    // gesto do usuário. Abrir depois da resposta seria bloqueado como popup.
    const aba = window.open("", "_blank", "noopener,noreferrer");
    try {
      const { url } = await DriveService.getClientFolder(clientId);
      if (aba) {
        aba.location.href = url;
      } else {
        // Bloqueador de popup ativo — melhor navegar na própria aba que perder
        // o clique em silêncio.
        window.location.href = url;
      }
    } catch (error) {
      aba?.close();
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Não foi possível abrir a pasta no Google Drive.",
      );
    } finally {
      setIsOpening(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      onClick={() => void handleClick()}
      disabled={isOpening}
    >
      {isOpening ? (
        <Loader size="sm" variant="button" className="mr-2" />
      ) : (
        <FolderOpen className="mr-2 h-4 w-4" />
      )}
      Pasta no Drive
    </Button>
  );
}
