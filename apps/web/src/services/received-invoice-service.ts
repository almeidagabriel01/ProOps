import { callApi } from "@/lib/api-client";

/**
 * Notas de ENTRADA — as que os fornecedores emitem contra o CNPJ do tenant.
 *
 * Separado de `fiscal-service` de propósito: aqui **não somos o emitente**.
 * Não há numeração para controlar, nada é assinado por nós e não existe
 * cancelamento — só recepção, manifestação e guarda.
 */

/** Situação da nota perante a Receita, do ponto de vista do destinatário. */
export type ReceivedInvoiceStatus = "resumo" | "completa" | "cancelada";

/**
 * Manifestação do destinatário (Ajuste SINIEF 07/2005).
 *
 * Ato formal perante a Receita, nunca automático: desconhecer uma operação
 * legítima — ou confirmar uma indevida — tem consequência fiscal.
 */
export type ManifestationType =
  | "ciencia"
  | "confirmacao"
  | "desconhecimento"
  | "nao_realizada";

export const MANIFESTATION_JUSTIFICATION_MIN_LENGTH = 15;
export const MANIFESTATION_JUSTIFICATION_MAX_LENGTH = 255;

/** Só "não realizada" exige justificativa — espelha a regra do backend. */
export function requiresJustification(tipo: ManifestationType): boolean {
  return tipo === "nao_realizada";
}

/** Só a confirmação libera o XML completo, com os itens. */
export function unlocksItems(tipo: ManifestationType): boolean {
  return tipo === "confirmacao";
}

export interface ReceivedInvoiceItem {
  numero: number;
  codigo?: string;
  descricao: string;
  /** O que torna este módulo útil para a emissão: alimenta o catálogo fiscal. */
  ncm?: string;
  cfop?: string;
  unidade?: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface ReceivedInvoice {
  id: string;
  tenantId: string;
  chaveAcesso: string;
  versao: number;
  status: ReceivedInvoiceStatus;
  emitenteCnpj: string;
  emitenteNome?: string;
  emitenteUf?: string;
  numero?: string;
  serie?: string;
  dataEmissao?: string;
  valorTotal: number;
  /** Só depois da confirmação — antes a Receita entrega apenas o resumo. */
  itens?: ReceivedInvoiceItem[];
  manifestacao?: ManifestationType;
  manifestadaEm?: string;
  manifestacaoJustificativa?: string;
  transactionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncResult {
  applied: number;
}

/** Despesa já existente que se parece com esta nota. */
export interface DuplicateCandidate {
  id: string;
  description: string;
  amount: number;
  date: string;
}

export type LaunchResult =
  | { outcome: "created"; invoice: ReceivedInvoice; transactionId: string }
  | { outcome: "already_launched"; transactionId: string };

export const ReceivedInvoiceService = {
  list: (params?: { limit?: number }) => {
    const query = params?.limit ? `?limit=${params.limit}` : "";
    return callApi<{ invoices: ReceivedInvoice[] }>(
      `/v1/fiscal/received-invoices${query}`,
      "GET",
    );
  },

  /** Busca sob demanda. O cron já roda de hora em hora; isto é para quem acabou de comprar. */
  sync: () => callApi<SyncResult>("/v1/fiscal/received-invoices/sync", "POST", {}),

  get: (chave: string) =>
    callApi<ReceivedInvoice>(`/v1/fiscal/received-invoices/${chave}`, "GET"),

  /**
   * Transforma a nota em despesa.
   *
   * Responde 409 com `candidates` quando já existe despesa parecida no período
   * — aviso, não bloqueio: reenviar com `force` prossegue. Quem compra costuma
   * já ter lançado a compra à mão, e duplicar suja o saldo da carteira.
   */
  launch: (chave: string, options?: { force?: boolean; wallet?: string }) =>
    callApi<LaunchResult>(
      `/v1/fiscal/received-invoices/${chave}/lancamento`,
      "POST",
      options ?? {},
    ),

  manifest: (chave: string, tipo: ManifestationType, justificativa?: string) =>
    callApi<ReceivedInvoice>(
      `/v1/fiscal/received-invoices/${chave}/manifestacao`,
      "POST",
      justificativa ? { tipo, justificativa } : { tipo },
    ),
};
