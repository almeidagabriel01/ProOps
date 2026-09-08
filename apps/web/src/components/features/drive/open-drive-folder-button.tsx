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
    /**
     * A aba precisa ser aberta AGORA, dentro do gesto do usuário.
     *
     * A pasta pode nem existir ainda — ela é criada nesta chamada —, então a
     * URL só é conhecida depois do `await`. E abrir depois dele já não conta
     * como gesto: o navegador bloqueia e o clique não faz nada, que foi o que
     * aconteceu com um link temporário clicado após a resposta.
     *
     * **Sem `noopener` na string de opções**: com ele o `window.open` devolve
     * `null` por especificação mesmo abrindo a aba, e qualquer decisão baseada
     * no retorno sai errada. O isolamento vem de zerar o `opener` enquanto a
     * aba ainda é `about:blank` — antes de ela navegar para fora do domínio.
     */
    const aba = window.open("", "_blank");
    try {
      const { url } = await DriveService.getClientFolder(clientId);
      if (aba) {
        aba.opener = null;
        aba.location.href = url;
      } else {
        // Popup bloqueado de verdade: navegar aqui é melhor que perder o
        // clique em silêncio.
        window.location.href = url;
      }
    } catch (error) {
      // Aba em branco sobrando é pior que não abrir nada.
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
