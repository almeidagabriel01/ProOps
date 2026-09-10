"use client";

import * as React from "react";
import {
  ProposalNumberingService,
  type ProposalNumberingConfig,
} from "@/services/proposal-numbering-service";

/**
 * Configuração da numeração, para o formulário de proposta saber se deve pedir
 * a praça.
 *
 * Falha em silêncio de propósito: se a leitura não voltar, o campo some e a
 * proposta é criada sem praça, caindo na padrão da empresa. Bloquear o
 * formulário inteiro por causa de um campo opcional seria pior que o problema.
 */
export function useProposalNumbering() {
  const [config, setConfig] = React.useState<ProposalNumberingConfig | null>(
    null,
  );
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let ativo = true;
    void (async () => {
      try {
        const atual = await ProposalNumberingService.get();
        if (ativo) setConfig(atual);
      } catch {
        if (ativo) setConfig(null);
      } finally {
        if (ativo) setIsLoading(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  return { config, isLoading };
}
