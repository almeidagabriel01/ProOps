import { callApi } from "@/lib/api-client";

/**
 * Configuração da numeração de proposta, uma por empresa.
 *
 * Vive numa coleção que as regras do Firestore fecham dos dois lados (o
 * contador não pode ser escrito pelo cliente), então tudo aqui passa pela API,
 * inclusive a leitura.
 */
export interface ProposalNumberingConfig {
  /** Nasce desligada: quem não pediu numeração não ganha um código. */
  enabled: boolean;
  /** Quantos dígitos o sequencial ocupa, com zeros à esquerda. */
  digits: number;
  /** `true` volta para 1 a cada ano; `false` atravessa o ano. */
  resetYearly: boolean;
  /** Siglas que a empresa usa, ex. ["SP", "RJ"]. Vazio = código sem praça. */
  pracas: string[];
  /** Sugerida na proposta nova. Sempre uma das de `pracas`. */
  defaultPraca: string | null;
  /** Próximo número a ser entregue. */
  nextNumber: number;
  /** Ano do `nextNumber`, usado só quando `resetYearly`. */
  year: number;
}

export const ProposalNumberingService = {
  get: async (): Promise<ProposalNumberingConfig> =>
    callApi<ProposalNumberingConfig>("/v1/proposals/numbering", "GET"),

  update: async (
    config: Partial<ProposalNumberingConfig>,
  ): Promise<ProposalNumberingConfig> =>
    callApi<ProposalNumberingConfig>("/v1/proposals/numbering", "PUT", config),
};
